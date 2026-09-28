import "server-only";

import { createAdminClient } from "@/src/lib/supabase/admin";
import { preparePaidOrderConfirmation, type PaidConfirmationOrder } from "@/src/lib/communications/order-messages";
import { sendTransactionalEmail } from "@/src/lib/email/send";
import { recordPaymentNotification } from "@/src/lib/notifications/record";
import { usdToCents } from "./money";

export type PaymentLifecycleStatus = "pending" | "paid" | "failed" | "cancelled" | "refunded";
export type PaymentProvider = "square" | "paypal";

export type RecordedOrder = {
  id: string;
  order_number: string;
  confirmation_code: string;
  guest_access_token: string;
  payment_status: string;
  payment_method: string | null;
  payment_provider: string | null;
  provider_order_id: string | null;
  provider_payment_id: string | null;
  fulfillment_method: string;
  customer_email: string;
  customer_name: string;
  total: number | string;
  status: string;
  email_sent_at: string | null;
  created_at?: string;
  shipping_address?: PaidConfirmationOrder["shipping_address"];
};

const ORDER_COLUMNS =
  "id, order_number, confirmation_code, guest_access_token, payment_status, payment_method, payment_provider, provider_order_id, provider_payment_id, fulfillment_method, customer_email, customer_name, total, status, email_sent_at, shipping_address, created_at";

export function requireAdminClient() {
  const client = createAdminClient();
  if (!client) {
    throw new Error("Payments cannot be recorded. Server payment configuration is incomplete.");
  }
  return client;
}

export async function loadOrderById(orderId: string) {
  const supabase = requireAdminClient();
  const { data, error } = await supabase.from("orders").select(ORDER_COLUMNS).eq("id", orderId).maybeSingle();
  if (error) throw new Error("Unable to load the order for payment.");
  return data as RecordedOrder | null;
}

export async function recordPaymentEvent(input: {
  provider: PaymentProvider;
  providerEventId: string;
  orderId?: string | null;
}) {
  const supabase = requireAdminClient();
  const { data, error } = await supabase
    .from("payment_events")
    .insert({
      provider: input.provider,
      provider_event_id: input.providerEventId,
      order_id: input.orderId ?? null,
    })
    .select("id")
    .maybeSingle();
  if (error) {
    if (error.code === "23505") return { duplicate: true as const };
    throw new Error("Unable to record the payment event.");
  }
  return { duplicate: false as const, id: data?.id };
}

export async function applyVerifiedPayment(input: {
  orderId: string;
  provider: PaymentProvider;
  status: PaymentLifecycleStatus;
  amountCents?: number;
  providerPaymentId?: string | null;
  providerOrderId?: string | null;
  eventId?: string;
}): Promise<{ order: RecordedOrder; duplicate: boolean; emailSent: boolean }> {
  const supabase = requireAdminClient();
  const existing = await loadOrderById(input.orderId);
  if (!existing) throw new Error("Order not found.");

  if (input.eventId) {
    const event = await recordPaymentEvent({
      provider: input.provider,
      providerEventId: input.eventId,
      orderId: input.orderId,
    });
    if (event.duplicate) {
      return { order: existing, duplicate: true, emailSent: Boolean(existing.email_sent_at) };
    }
  }

  if (input.status === "paid") {
    if (input.amountCents == null || input.amountCents !== usdToCents(existing.total)) {
      throw new Error("Verified payment amount does not match the order total.");
    }
    if (existing.payment_status === "paid") {
      return { order: existing, duplicate: true, emailSent: Boolean(existing.email_sent_at) };
    }
    const nextStatus = existing.status === "pending" ? "confirmed" : existing.status;
    const { data, error } = await supabase
      .from("orders")
      .update({
        payment_status: "paid",
        payment_provider: input.provider,
        payment_method: input.provider,
        provider_payment_id: input.providerPaymentId ?? existing.provider_payment_id,
        provider_order_id: input.providerOrderId ?? existing.provider_order_id,
        status: nextStatus,
        updated_at: new Date().toISOString(),
      })
      .eq("id", existing.id)
      .neq("payment_status", "paid")
      .select(ORDER_COLUMNS)
      .maybeSingle();
    if (error) throw new Error("Unable to mark the order paid.");
    const order = (data as RecordedOrder | null) ?? { ...existing, payment_status: "paid" };
    const emailSent = await sendPaidConfirmation(order);
    await recordPaymentNotification(supabase, order.id, "paid", emailSent);
    return { order, duplicate: false, emailSent };
  }

  if (existing.payment_status === "paid") {
    return { order: existing, duplicate: true, emailSent: Boolean(existing.email_sent_at) };
  }

  const { data, error } = await supabase
    .from("orders")
    .update({
      payment_status: input.status,
      payment_provider: input.provider,
      payment_method: input.provider,
      provider_payment_id: input.providerPaymentId ?? existing.provider_payment_id,
      provider_order_id: input.providerOrderId ?? existing.provider_order_id,
      updated_at: new Date().toISOString(),
    })
    .eq("id", existing.id)
    .neq("payment_status", "paid")
    .select(ORDER_COLUMNS)
    .maybeSingle();
    if (error) throw new Error("Unable to update payment status.");
    const updated = (data as RecordedOrder | null) ?? existing;
    await recordPaymentNotification(supabase, updated.id, input.status, false);
    return { order: updated, duplicate: false, emailSent: false };
}

export async function storeProviderOrderId(orderId: string, provider: PaymentProvider, providerOrderId: string) {
  const supabase = requireAdminClient();
  const { error } = await supabase
    .from("orders")
    .update({
      payment_provider: provider,
      payment_method: provider,
      provider_order_id: providerOrderId,
      updated_at: new Date().toISOString(),
    })
    .eq("id", orderId)
    .neq("payment_status", "paid");
  if (error) throw new Error("Unable to store the provider order.");
}

export async function sendPaidConfirmation(order: RecordedOrder) {
  try {
    const supabase = requireAdminClient();
    await supabase.from("orders").update({ email_attempted_at: new Date().toISOString() }).eq("id", order.id);
    const { data: items } = await supabase
      .from("order_items")
      .select("product_name, product_price, quantity")
      .eq("order_id", order.id);
    const message = preparePaidOrderConfirmation({
      ...order,
      order_items: items ?? [],
    });
    const result = await sendTransactionalEmail(message);
    if (result.sent) {
      await supabase.from("orders").update({ email_sent_at: new Date().toISOString() }).eq("id", order.id);
      return true;
    }
    console.error("[order-email] not sent", { orderNumber: order.order_number, reason: result.reason });
    return false;
  } catch (error) {
    console.error("[order-email] confirmation failed", {
      orderNumber: order.order_number,
      detail: error instanceof Error ? error.message.slice(0, 180) : "unknown",
    });
    return false;
  }
}
