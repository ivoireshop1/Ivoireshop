"use server";

import { placeCheckoutOrder } from "@/src/lib/checkout/actions";
import { validateCheckout, type CheckoutReceipt } from "@/src/lib/checkout/checkout-validation";
import { createAdminClient } from "@/src/lib/supabase/admin";
import { createClient } from "@/src/lib/supabase/server";
import { requireAdmin } from "@/src/lib/auth/guards";
import { collectCheckoutOptions } from "@/src/lib/delivery/orchestrate";
import { clientQuotedTotalMatches, quoteFromAuthoritativeParts } from "./totals";
import { getStripeConfig } from "./stripe-config";
import { stripeClient } from "./stripe-server";
import { usdToCents } from "./money";
import { loadOrderById } from "./record";

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export type StripePrepareResult =
  | {
      success: true;
      clientSecret: string;
      publishableKey: string;
      receipt: CheckoutReceipt;
      totalCents: number;
      subtotal: number;
      shipping: number;
      tax: number;
      total: number;
    }
  | { success: false; error: string; totalsChanged?: boolean; subtotal?: number; shipping?: number; tax?: number; total?: number };

async function authoritativeQuote(input: ReturnType<typeof validateCheckout> & { request?: NonNullable<ReturnType<typeof validateCheckout>["request"]> }) {
  if (!input.request) return null;
  const request = input.request;
  const supabase = await createClient();
  const { data: catalog } = await supabase
    .from("products")
    .select("id, price, ship_weight_lb, ship_length_in, ship_width_in, ship_height_in")
    .in("id", request.items.map((item) => item.product_id));
  const byId = new Map((catalog ?? []).map((row) => [row.id, row]));
  const quotes = await collectCheckoutOptions({
    destination: request.address,
    products: request.items.map((item) => ({ quantity: item.quantity, ...byId.get(item.product_id) })),
  });
  const selectedId = request.deliveryOptionId || (request.fulfillmentMethod === "local_pickup" ? "pickup" : "store");
  const selected = quotes.options.find((option) => option.id === selectedId);
  if (!selected || selected.fulfillmentMethod !== request.fulfillmentMethod) {
    return { ok: false as const, message: "Choose an available pickup or delivery option." };
  }
  const breakdown = quotes.breakdowns[selected.id];
  const quote = quoteFromAuthoritativeParts({
    unitPrices: request.items.map((item) => ({ price: byId.get(item.product_id)?.price ?? 0, quantity: item.quantity })),
    shippingAmount: breakdown?.shipping ?? selected.amount,
    tax: quotes.tax,
  });
  return { ok: true as const, quotes, selected, quote };
}

export async function prepareStripePayment(input: {
  checkout: unknown;
  expectedTotal?: number | null;
}): Promise<StripePrepareResult> {
  const stripe = getStripeConfig();
  if (!stripe.canCollect || !stripe.public) {
    return {
      success: false,
      error: stripe.missingNames.length
        ? `Stripe is not configured. Missing ${stripe.missingNames.join(", ")}.`
        : "Stripe is not configured.",
    };
  }
  const validated = validateCheckout(input.checkout);
  if (validated.error || !validated.request) return { success: false, error: validated.error || "Invalid checkout request." };
  const quoted = await authoritativeQuote(validated);
  if (!quoted) return { success: false, error: "Unable to quote this checkout." };
  if (!quoted.ok) return { success: false, error: quoted.message };
  if (!clientQuotedTotalMatches(quoted.quote.totalCents, input.expectedTotal)) {
    return {
      success: false,
      error: "Checkout totals were updated. Review the new total before paying.",
      totalsChanged: true,
      subtotal: quoted.quote.subtotal,
      shipping: quoted.quote.shipping,
      tax: quoted.quote.tax,
      total: quoted.quote.total,
    };
  }
  const placed = await placeCheckoutOrder(validated.request);
  if (!placed.success) return { success: false, error: placed.error };
  const admin = createAdminClient();
  if (!admin) return { success: false, error: "Payments cannot be recorded." };
  const { data: order } = await admin
    .from("orders")
    .select("id, total, payment_status, provider_payment_id, customer_email")
    .eq("id", placed.receipt.order_id)
    .maybeSingle();
  if (!order) return { success: false, error: "The order could not be loaded for payment." };
  if (order.payment_status === "paid") {
    return { success: false, error: "This order is already paid." };
  }
  const amount = usdToCents(order.total);
  if (amount !== quoted.quote.totalCents) {
    return {
      success: false,
      error: "Checkout totals were updated. Review the new total before paying.",
      totalsChanged: true,
      subtotal: quoted.quote.subtotal,
      shipping: quoted.quote.shipping,
      tax: quoted.quote.tax,
      total: quoted.quote.total,
    };
  }
  try {
    const client = stripeClient();
    const intentId = order.provider_payment_id;
    if (intentId && intentId.startsWith("pi_")) {
      const existing = await client.paymentIntents.retrieve(intentId);
      if (existing.status === "succeeded") return { success: false, error: "This order is already paid." };
      if (existing.status === "requires_payment_method" || existing.status === "requires_confirmation" || existing.status === "requires_action") {
        const updated = existing.amount === amount
          ? existing
          : await client.paymentIntents.update(existing.id, { amount, metadata: { order_id: order.id, order_number: placed.receipt.order_number } });
        await admin.from("orders").update({
          payment_provider: "stripe",
          payment_method: "card",
          provider_payment_id: updated.id,
        }).eq("id", order.id).neq("payment_status", "paid");
        return {
          success: true,
          clientSecret: updated.client_secret!,
          publishableKey: stripe.public.publishableKey,
          receipt: { ...placed.receipt, payment_provider: "stripe", payment_method: "card", payment_status: "pending", subtotal: quoted.quote.subtotal, shipping_cost: quoted.quote.shipping, tax_amount: quoted.quote.tax, total: quoted.quote.total },
          totalCents: amount,
          subtotal: quoted.quote.subtotal,
          shipping: quoted.quote.shipping,
          tax: quoted.quote.tax,
          total: quoted.quote.total,
        };
      }
    }
    const created = await client.paymentIntents.create({
      amount,
      currency: "usd",
      automatic_payment_methods: { enabled: true },
      receipt_email: order.customer_email || placed.receipt.customer_email,
      metadata: {
        order_id: order.id,
        order_number: placed.receipt.order_number,
      },
    }, { idempotencyKey: `ivoire-pi-${order.id}` });
    await admin.from("orders").update({
      payment_provider: "stripe",
      payment_method: "card",
      provider_payment_id: created.id,
    }).eq("id", order.id).neq("payment_status", "paid");
    return {
      success: true,
      clientSecret: created.client_secret!,
      publishableKey: stripe.public.publishableKey,
      receipt: { ...placed.receipt, payment_provider: "stripe", payment_method: "card", payment_status: "pending", subtotal: quoted.quote.subtotal, shipping_cost: quoted.quote.shipping, tax_amount: quoted.quote.tax, total: quoted.quote.total },
      totalCents: amount,
      subtotal: quoted.quote.subtotal,
      shipping: quoted.quote.shipping,
      tax: quoted.quote.tax,
      total: quoted.quote.total,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    return { success: false, error: message && message.length < 180 ? message : "Stripe could not start this payment. Please try again." };
  }
}

export async function stripePaymentStatus(idempotencyKey: string) {
  if (!uuid.test(idempotencyKey)) return { error: "Refresh checkout before trying again." };
  const supabase = await createClient();
  const { data } = await supabase.rpc("get_session_checkout_order", { p_idempotency_key: idempotencyKey });
  const row = Array.isArray(data) ? data[0] : data;
  if (!row?.order_id) return { error: "We could not find this checkout in the current session." };
  return {
    payment_status: String(row.payment_status),
    receipt: {
      order_id: String(row.order_id),
      order_number: String(row.order_number),
      status: String(row.status),
      total: Number(row.total),
      confirmation_code: row.confirmation_code ? String(row.confirmation_code) : undefined,
      guest_access_token: row.guest_access_token ? String(row.guest_access_token) : undefined,
      payment_status: String(row.payment_status),
      fulfillment_method: String(row.fulfillment_method),
      customer_email: String(row.customer_email),
      customer_name: String(row.customer_name),
      payment_method: row.payment_method ? String(row.payment_method) : "card",
      payment_provider: row.payment_provider ? String(row.payment_provider) : "stripe",
    } satisfies CheckoutReceipt,
  };
}

export async function refundStripeOrder(orderId: string, confirm: string) {
  await requireAdmin();
  if (confirm !== "REFUND") return { error: "Type REFUND to confirm." };
  if (!uuid.test(orderId)) return { error: "Invalid order." };
  const order = await loadOrderById(orderId);
  if (!order) return { error: "Order not found." };
  if (order.payment_provider !== "stripe" || !order.provider_payment_id) return { error: "This order was not paid with Stripe." };
  if (order.payment_status !== "paid" && order.payment_status !== "partially_refunded") return { error: "This order is not refundable." };
  const paidCents = usdToCents(order.amount_paid && Number(order.amount_paid) > 0 ? order.amount_paid : order.total);
  const already = usdToCents(order.refunded_amount ?? 0);
  const remaining = paidCents - already;
  if (remaining <= 0) return { error: "This order is already refunded." };
  const refund = await stripeClient().refunds.create({
    payment_intent: order.provider_payment_id,
    amount: remaining,
    metadata: { order_id: order.id },
  }, { idempotencyKey: `ivoire-refund-${order.id}-${remaining}` });
  return { saved: true, refundId: refund.id };
}
