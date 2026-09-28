"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/src/lib/supabase/server";
import { getPublicSiteUrl } from "@/src/lib/site";
import { getPaymentReadiness } from "./readiness";
import { usdToCents } from "./money";
import { createSquarePayment, squarePaymentMatches, squarePaymentPending } from "./square";
import { capturePaypalOrder, createPaypalOrder } from "./paypal";
import { applyVerifiedPayment, storeProviderOrderId } from "./record";
import type { CheckoutReceipt } from "@/src/lib/checkout/checkout-validation";

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

type SessionOrder = {
  order_id: string;
  order_number: string;
  status: string;
  total: number | string;
  confirmation_code: string;
  guest_access_token: string;
  payment_status: string;
  fulfillment_method: string;
  customer_email: string;
  customer_name: string;
  payment_method: string | null;
  payment_provider: string | null;
  provider_order_id: string | null;
  provider_payment_id: string | null;
};

export type PaymentActionResult =
  | { success: true; receipt: CheckoutReceipt; emailSent: boolean }
  | { success: false; error: string; pending?: boolean; cancelled?: boolean; receipt?: CheckoutReceipt };

function receiptFromOrder(order: SessionOrder, extras?: Partial<CheckoutReceipt>): CheckoutReceipt {
  return {
    order_id: String(order.order_id),
    order_number: String(order.order_number),
    status: String(order.status),
    total: Number(order.total),
    confirmation_code: String(order.confirmation_code),
    guest_access_token: String(order.guest_access_token),
    payment_status: String(order.payment_status),
    fulfillment_method: String(order.fulfillment_method),
    customer_email: String(order.customer_email),
    customer_name: String(order.customer_name),
    payment_method: order.payment_method ? String(order.payment_method) : null,
    payment_provider: order.payment_provider ? String(order.payment_provider) : null,
    ...extras,
  };
}

async function loadSessionOrder(idempotencyKey: string): Promise<{ order: SessionOrder } | { error: string }> {
  if (!uuid.test(idempotencyKey)) return { error: "Refresh checkout before trying again." };
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_session_checkout_order", { p_idempotency_key: idempotencyKey });
  if (error) return { error: "We could not load this checkout. Please try again." };
  const row = Array.isArray(data) ? data[0] : data;
  if (!row?.order_id) return { error: "We could not find this checkout in the current session." };
  return { order: row as SessionOrder };
}

function revalidateOrder(orderId: string) {
  try {
    for (const path of ["/", "/shop", "/admin", "/admin/orders", "/account"]) revalidatePath(path);
    revalidatePath(`/admin/orders/${orderId}`);
    revalidatePath(`/account/orders/${orderId}`);
  } catch {
    /* Payment already recorded. */
  }
}

export async function payWithSquare(input: { idempotencyKey: string; sourceId: string }): Promise<PaymentActionResult> {
  const readiness = getPaymentReadiness();
  if (!readiness.square.ready) return { success: false, error: "Square is not configured." };
  if (typeof input.sourceId !== "string" || input.sourceId.length < 8 || input.sourceId.length > 200) {
    return { success: false, error: "Card details could not be verified. Please try again." };
  }
  const loaded = await loadSessionOrder(input.idempotencyKey);
  if (!("order" in loaded)) return { success: false, error: loaded.error };
  const order = loaded.order;
  if (order.payment_status === "paid") return { success: true, receipt: receiptFromOrder(order), emailSent: true };
  const amountCents = usdToCents(order.total);
  const supabase = await createClient();
  await supabase.rpc("set_session_checkout_provider", { p_idempotency_key: input.idempotencyKey, p_provider: "square" });
  const charged = await createSquarePayment({
    sourceId: input.sourceId,
    amountCents,
    idempotencyKey: `square-${order.order_id}`,
    referenceId: order.order_id,
  });
  if (!charged.ok) {
    if (charged.declined) {
      await applyVerifiedPayment({ orderId: order.order_id, provider: "square", status: "failed" }).catch(() => undefined);
    }
    return { success: false, error: charged.error };
  }
  if (squarePaymentPending(charged.payment)) {
    return {
      success: false,
      pending: true,
      error: "Payment is processing",
      receipt: receiptFromOrder({ ...order, payment_status: "pending", payment_provider: "square" }),
    };
  }
  if (!squarePaymentMatches(charged.payment, amountCents) || !charged.payment.id) {
    await applyVerifiedPayment({ orderId: order.order_id, provider: "square", status: "failed" }).catch(() => undefined);
    return { success: false, error: "Payment couldn't be completed. Please try again." };
  }
  const recorded = await applyVerifiedPayment({
    orderId: order.order_id,
    provider: "square",
    status: "paid",
    amountCents,
    providerPaymentId: charged.payment.id,
    eventId: `square-payment-${charged.payment.id}`,
  });
  revalidateOrder(order.order_id);
  return {
    success: true,
    emailSent: recorded.emailSent,
    receipt: receiptFromOrder({ ...order, ...recorded.order, order_id: recorded.order.id, payment_status: recorded.order.payment_status }),
  };
}

export async function startPaypalPayment(input: { idempotencyKey: string }): Promise<
  { success: true; paypalOrderId: string } | PaymentActionResult
> {
  const readiness = getPaymentReadiness();
  if (!readiness.paypal.ready) return { success: false, error: "PayPal is not configured." };
  const loaded = await loadSessionOrder(input.idempotencyKey);
  if (!("order" in loaded)) return { success: false, error: loaded.error };
  const order = loaded.order;
  if (order.payment_status === "paid") return { success: true, receipt: receiptFromOrder(order), emailSent: true };
  const supabase = await createClient();
  await supabase.rpc("set_session_checkout_provider", { p_idempotency_key: input.idempotencyKey, p_provider: "paypal" });
  if (order.provider_order_id && order.payment_provider === "paypal") {
    return { success: true, paypalOrderId: order.provider_order_id };
  }
  const created = await createPaypalOrder({
    amountCents: usdToCents(order.total),
    ivoireOrderId: order.order_id,
    orderNumber: order.order_number,
    returnOrigin: getPublicSiteUrl(),
  });
  if (!created.ok) return { success: false, error: created.error };
  await storeProviderOrderId(order.order_id, "paypal", created.id);
  return { success: true, paypalOrderId: created.id };
}

export async function capturePaypalPayment(input: { idempotencyKey: string; paypalOrderId: string }): Promise<PaymentActionResult> {
  const readiness = getPaymentReadiness();
  if (!readiness.paypal.ready) return { success: false, error: "PayPal is not configured." };
  if (typeof input.paypalOrderId !== "string" || input.paypalOrderId.length < 8 || input.paypalOrderId.length > 64) {
    return { success: false, error: "PayPal checkout was cancelled." };
  }
  const loaded = await loadSessionOrder(input.idempotencyKey);
  if (!("order" in loaded)) return { success: false, error: loaded.error };
  const order = loaded.order;
  if (order.payment_status === "paid") return { success: true, receipt: receiptFromOrder(order), emailSent: true };
  const captured = await capturePaypalOrder(input.paypalOrderId);
  if (!captured.ok) return { success: false, error: captured.error };
  if (captured.customId && captured.customId !== order.order_id) {
    return { success: false, error: "PayPal checkout could not be matched to this order." };
  }
  if (captured.captureStatus === "PENDING" || captured.status === "PAYER_ACTION_REQUIRED") {
    return { success: false, pending: true, error: "Payment is processing" };
  }
  if (captured.captureStatus !== "COMPLETED" || captured.currency !== "USD" || captured.amountCents == null) {
    await applyVerifiedPayment({ orderId: order.order_id, provider: "paypal", status: "failed" }).catch(() => undefined);
    return { success: false, error: "Payment couldn't be completed. Please try again." };
  }
  const recorded = await applyVerifiedPayment({
    orderId: order.order_id,
    provider: "paypal",
    status: "paid",
    amountCents: captured.amountCents,
    providerPaymentId: captured.captureId,
    providerOrderId: captured.id,
    eventId: captured.captureId ? `paypal-capture-${captured.captureId}` : `paypal-order-${captured.id}`,
  });
  revalidateOrder(order.order_id);
  return {
    success: true,
    emailSent: recorded.emailSent,
    receipt: receiptFromOrder({ ...order, ...recorded.order, order_id: recorded.order.id, payment_status: recorded.order.payment_status }),
  };
}

export async function markPaypalCancelled(input: { idempotencyKey: string }): Promise<PaymentActionResult> {
  const loaded = await loadSessionOrder(input.idempotencyKey);
  if (!("order" in loaded)) return { success: false, error: loaded.error };
  return { success: false, cancelled: true, error: "PayPal checkout was cancelled." };
}
