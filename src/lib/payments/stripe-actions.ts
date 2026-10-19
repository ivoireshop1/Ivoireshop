"use server";

import { placeCheckoutOrder, type PreResolvedCheckoutShipping } from "@/src/lib/checkout/actions";
import { validateCheckout, type CheckoutReceipt } from "@/src/lib/checkout/checkout-validation";
import { createAdminClient } from "@/src/lib/supabase/admin";
import { createClient } from "@/src/lib/supabase/server";
import { requireAdmin } from "@/src/lib/auth/guards";
import { collectCheckoutOptions } from "@/src/lib/delivery/orchestrate";
import { resolveSelectedShippingOption } from "@/src/lib/shipping/shippo";
import { clientQuotedTotalMatches, quoteFromAuthoritativeParts } from "./totals";
import { getStripeConfig } from "./stripe-config";
import { hasPaymentAdminClient } from "./config";
import { CUSTOMER_CARD_UNAVAILABLE } from "./customer-copy";
import { TAX_PAYMENT_BLOCKED_MESSAGE, taxReadyForPaidCheckout } from "@/src/lib/tax/readiness";
import { stripeClient } from "./stripe-server";
import { usdToCents } from "./money";
import { applyVerifiedPayment, loadOrderById } from "./record";
import { nextStripeIntentAction, stripeIntentIdempotencyKey } from "./stripe-intent";

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
  | {
      success: false;
      error: string;
      alreadyPaid?: boolean;
      receipt?: CheckoutReceipt;
      totalsChanged?: boolean;
      subtotal?: number;
      shipping?: number;
      tax?: number;
      total?: number;
    };

async function authoritativeQuote(input: ReturnType<typeof validateCheckout> & { request?: NonNullable<ReturnType<typeof validateCheckout>["request"]> }) {
  if (!input.request) return null;
  const request = input.request;
  const supabase = await createClient();
  const { data: catalog } = await supabase
    .from("products")
    .select("id, price, selling_method, selling_unit, unit_increment, min_sell_qty, max_sell_qty, package_weight_lb, ship_weight_lb, ship_length_in, ship_width_in, ship_height_in")
    .in("id", request.items.map((item) => item.product_id));
  const byId = new Map((catalog ?? []).map((row) => [row.id, row]));
  const products = request.items.map((item) => ({ quantity: item.quantity, ...byId.get(item.product_id) }));
  const selectedId = request.deliveryOptionId || (request.fulfillmentMethod === "local_pickup" ? "pickup" : "store");
  const isLiveSelection = selectedId.includes(":live:");

  const shippoBusy = (message?: string | null) =>
    Boolean(message && /too many requests|10429|rate.?limit|briefly busy|temporarily busy/i.test(message));
  const liveCarrier = selectedId.startsWith("ups:") ? "ups" as const : selectedId.startsWith("usps:") ? "usps" as const : null;
  /** Carrier enabled in admin but Shippo returned zero rates — treat as temporary API failure, not permanent unavailability. */
  const carrierOmitted = (quoted: { options: Array<{ provider: string; rateMode?: string }>; expectedLiveCarriers?: Array<"ups" | "usps"> }) =>
    Boolean(
      liveCarrier
      && (quoted.expectedLiveCarriers ?? []).includes(liveCarrier)
      && !quoted.options.some((option) => option.provider === liveCarrier && option.rateMode === "live_api"),
    );

  let quotes = await collectCheckoutOptions({
    destination: request.address,
    products,
  });
  let resolved = resolveSelectedShippingOption(quotes.options, selectedId, request.fulfillmentMethod, request.quotedShipping);
  // Bounded backoff (max 2) when Shippo omits the selected live carrier (often UPS 10429).
  if ("error" in resolved && resolved.stale && isLiveSelection && (shippoBusy(quotes.message) || carrierOmitted(quotes))) {
    for (let attempt = 1; attempt <= 2; attempt += 1) {
      await new Promise((resolve) => setTimeout(resolve, attempt * 1500));
      quotes = await collectCheckoutOptions({
        destination: request.address,
        products,
      });
      resolved = resolveSelectedShippingOption(quotes.options, selectedId, request.fulfillmentMethod, request.quotedShipping);
      if (!("error" in resolved)) break;
      if (!(shippoBusy(quotes.message) || carrierOmitted(quotes))) break;
    }
  }
  if ("error" in resolved) {
    if (shippoBusy(quotes.message) || carrierOmitted(quotes)) {
      return {
        ok: false as const,
        message: "UPS/USPS rates are briefly busy. Wait a few seconds and try payment again — your cart and address were kept, and you will not create a duplicate order.",
        stale: true,
      };
    }
    return { ok: false as const, message: resolved.error, stale: resolved.stale === true };
  }
  const selected = resolved.option;
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
  if (stripe.liveBlocked) {
    return { success: false, error: CUSTOMER_CARD_UNAVAILABLE };
  }
  if (!stripe.configured || !stripe.public || !hasPaymentAdminClient()) {
    return {
      success: false,
      error: CUSTOMER_CARD_UNAVAILABLE,
    };
  }
  const validated = validateCheckout(input.checkout);
  if (validated.error || !validated.request) return { success: false, error: validated.error || "Invalid checkout request." };
  const quoted = await authoritativeQuote(validated);
  if (!quoted) return { success: false, error: "Unable to quote this checkout." };
  if (!quoted.ok) return { success: false, error: quoted.message, totalsChanged: quoted.stale === true };
  const taxGate = taxReadyForPaidCheckout(quoted.quotes.tax, { stripeMode: stripe.mode });
  if (!taxGate.ok) {
    return { success: false, error: TAX_PAYMENT_BLOCKED_MESSAGE };
  }
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
  const preResolved: PreResolvedCheckoutShipping = {
    selected: quoted.selected,
    shipping: quoted.quote.shipping,
    tax: quoted.quote.tax,
    taxLines: quoted.quotes.breakdowns[quoted.selected.id]?.taxLines,
    taxSettings: quoted.quotes.tax,
    subtotal: quoted.quote.subtotal,
    breakdowns: quoted.quotes.breakdowns,
  };
  const placed = await placeCheckoutOrder(validated.request, { preResolved });
  if (!placed.success) return { success: false, error: placed.error };
  const admin = createAdminClient();
  if (!admin) return { success: false, error: "Payments cannot be recorded." };
  const { data: order } = await admin
    .from("orders")
    .select("id, total, payment_status, provider_payment_id, customer_email, is_demo, payment_provider")
    .eq("id", placed.receipt.order_id)
    .maybeSingle();
  if (!order) return { success: false, error: "The order could not be loaded for payment." };
  if (order.is_demo || order.payment_provider === "demo" || order.payment_status === "demo") {
    return { success: false, error: "This is a demonstration order. Start a new checkout to pay with Stripe." };
  }
  const pendingReceipt: CheckoutReceipt = {
    ...placed.receipt,
    payment_provider: "stripe",
    payment_method: "card",
    payment_status: "pending",
    subtotal: quoted.quote.subtotal,
    shipping_cost: quoted.quote.shipping,
    tax_amount: quoted.quote.tax,
    total: quoted.quote.total,
  };
  const paidResult = (receipt: CheckoutReceipt): StripePrepareResult => ({
    success: false,
    alreadyPaid: true,
    error: "This order is already paid. Your confirmation is ready.",
    receipt: { ...receipt, payment_status: "paid", payment_provider: "stripe", payment_method: "card" },
  });
  if (order.payment_status === "paid") return paidResult(placed.receipt);
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
    let existing = intentId && intentId.startsWith("pi_") ? await client.paymentIntents.retrieve(intentId) : null;
    const action = nextStripeIntentAction({
      orderPaid: order.payment_status === "paid",
      intentStatus: existing?.status,
    });
    if (action === "already_paid" && existing) {
      try {
        await applyVerifiedPayment({
          orderId: order.id,
          provider: "stripe",
          status: "paid",
          amountCents: existing.amount_received || existing.amount,
          providerPaymentId: existing.id,
        });
      } catch {
        /* Confirmation still uses the verified Stripe success. */
      }
      return paidResult(placed.receipt);
    }
    if (action === "wait") {
      return { success: false, error: "This payment is still processing. Refresh in a moment to see confirmation. Do not pay again." };
    }
    if (action === "resume" && existing) {
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
        receipt: pendingReceipt,
        totalCents: amount,
        subtotal: quoted.quote.subtotal,
        shipping: quoted.quote.shipping,
        tax: quoted.quote.tax,
        total: quoted.quote.total,
      };
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
    }, { idempotencyKey: stripeIntentIdempotencyKey(order.id, action === "new" ? intentId : null) });
    const createdAction = nextStripeIntentAction({ orderPaid: false, intentStatus: created.status });
    if (createdAction === "already_paid") {
      try {
        await applyVerifiedPayment({
          orderId: order.id,
          provider: "stripe",
          status: "paid",
          amountCents: created.amount_received || created.amount,
          providerPaymentId: created.id,
        });
      } catch {
        /* Confirmation still uses the verified Stripe success. */
      }
      return paidResult(placed.receipt);
    }
    if (createdAction === "wait") {
      return { success: false, error: "This payment is still processing. Refresh in a moment to see confirmation. Do not pay again." };
    }
    if (!created.client_secret) {
      return { success: false, error: "Stripe could not start this payment. Please try again." };
    }
    await admin.from("orders").update({
      payment_provider: "stripe",
      payment_method: "card",
      provider_payment_id: created.id,
    }).eq("id", order.id).neq("payment_status", "paid");
    return {
      success: true,
      clientSecret: created.client_secret,
      publishableKey: stripe.public.publishableKey,
      receipt: pendingReceipt,
      totalCents: amount,
      subtotal: quoted.quote.subtotal,
      shipping: quoted.quote.shipping,
      tax: quoted.quote.tax,
      total: quoted.quote.total,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    const safe = message && message.length < 180 && !/sk_live|sk_test|whsec_|eyJ/.test(message)
      ? message
      : "Stripe could not start this payment. Please try again.";
    return { success: false, error: safe };
  }
}

function isDemoBlocked(order: { is_demo?: boolean | null; payment_provider?: string | null; payment_status?: string | null }) {
  return Boolean(order.is_demo || order.payment_provider === "demo" || order.payment_status === "demo");
}

async function reconcileSessionOrderFromStripe(orderId: string): Promise<{
  payment_status: string;
  confirmation_code?: string;
  guest_access_token?: string;
  intent_status?: string;
} | null> {
  const stripe = getStripeConfig();
  if (!stripe.configured || !hasPaymentAdminClient()) return null;
  const order = await loadOrderById(orderId);
  if (!order || isDemoBlocked(order)) return null;
  if (order.payment_status === "paid") {
    return {
      payment_status: order.payment_status,
      confirmation_code: order.confirmation_code,
      guest_access_token: order.guest_access_token,
      intent_status: "succeeded",
    };
  }
  const intentId = order.provider_payment_id;
  if (!intentId?.startsWith("pi_")) return null;
  try {
    const intent = await stripeClient().paymentIntents.retrieve(intentId);
    if (intent.status === "succeeded") {
      const applied = await applyVerifiedPayment({
        orderId: order.id,
        provider: "stripe",
        status: "paid",
        amountCents: intent.amount_received || intent.amount,
        providerPaymentId: intent.id,
      });
      return {
        payment_status: applied.order.payment_status,
        confirmation_code: applied.order.confirmation_code,
        guest_access_token: applied.order.guest_access_token,
        intent_status: intent.status,
      };
    }
    return {
      payment_status: order.payment_status,
      confirmation_code: order.confirmation_code,
      guest_access_token: order.guest_access_token,
      intent_status: intent.status,
    };
  } catch {
    return null;
  }
}

export async function stripePaymentStatus(idempotencyKey: string) {
  if (!uuid.test(idempotencyKey)) return { error: "Refresh checkout before trying again." };
  const supabase = await createClient();
  const { data } = await supabase.rpc("get_session_checkout_order", { p_idempotency_key: idempotencyKey });
  const row = Array.isArray(data) ? data[0] : data;
  if (!row?.order_id) return { error: "We could not find this checkout in the current session." };
  let paymentStatus = String(row.payment_status);
  let confirmationCode = row.confirmation_code ? String(row.confirmation_code) : undefined;
  let guestAccess = row.guest_access_token ? String(row.guest_access_token) : undefined;
  let intentHint: string | undefined;
  if (paymentStatus !== "paid" && paymentStatus !== "failed" && paymentStatus !== "cancelled") {
    const reconciled = await reconcileSessionOrderFromStripe(String(row.order_id));
    if (reconciled) {
      paymentStatus = reconciled.payment_status;
      confirmationCode = reconciled.confirmation_code || confirmationCode;
      guestAccess = reconciled.guest_access_token || guestAccess;
      intentHint = reconciled.intent_status;
    }
  }
  return {
    payment_status: paymentStatus,
    intent_status: intentHint,
    receipt: {
      order_id: String(row.order_id),
      order_number: String(row.order_number),
      status: String(row.status),
      total: Number(row.total),
      confirmation_code: confirmationCode,
      guest_access_token: guestAccess,
      payment_status: paymentStatus,
      fulfillment_method: String(row.fulfillment_method),
      customer_email: String(row.customer_email),
      customer_name: String(row.customer_name),
      payment_method: row.payment_method ? String(row.payment_method) : "card",
      payment_provider: row.payment_provider ? String(row.payment_provider) : "stripe",
    } satisfies CheckoutReceipt,
  };
}

/** Admin/server: reconcile one pending Stripe order from its existing PaymentIntent. Never creates a new charge. */
export async function reconcileStripeOrderPayment(orderId: string) {
  await requireAdmin();
  if (!uuid.test(orderId)) return { success: false as const, error: "Invalid order." };
  const stripe = getStripeConfig();
  if (!stripe.configured || !hasPaymentAdminClient()) {
    return { success: false as const, error: "Stripe is not configured." };
  }
  const order = await loadOrderById(orderId);
  if (!order) return { success: false as const, error: "Order not found." };
  if (isDemoBlocked(order)) return { success: false as const, error: "Demo orders cannot be reconciled as Stripe payments." };
  if (order.payment_status === "paid") {
    return { success: true as const, payment_status: "paid" as const, intent_status: "succeeded" as const, duplicate: true as const };
  }
  const intentId = order.provider_payment_id;
  if (!intentId?.startsWith("pi_")) {
    return { success: false as const, error: "This order has no Stripe PaymentIntent to reconcile." };
  }
  try {
    const intent = await stripeClient().paymentIntents.retrieve(intentId);
    if (intent.status === "succeeded") {
      await applyVerifiedPayment({
        orderId: order.id,
        provider: "stripe",
        status: "paid",
        amountCents: intent.amount_received || intent.amount,
        providerPaymentId: intent.id,
      });
      return { success: true as const, payment_status: "paid" as const, intent_status: intent.status, duplicate: false as const };
    }
    if (intent.status === "processing" || intent.status === "requires_capture") {
      return { success: false as const, payment_status: order.payment_status, intent_status: intent.status, error: "Stripe is still processing this payment. Do not charge again." };
    }
    if (intent.status === "requires_payment_method" || intent.status === "requires_confirmation" || intent.status === "requires_action") {
      return { success: false as const, payment_status: order.payment_status, intent_status: intent.status, error: "Payment was not completed. The customer can retry on the same order." };
    }
    return { success: false as const, payment_status: order.payment_status, intent_status: intent.status, error: "This PaymentIntent cannot be marked paid." };
  } catch {
    return { success: false as const, error: "Unable to read this PaymentIntent from Stripe." };
  }
}

/** TEST mode only: confirm the session PaymentIntent with Stripe's Visa test payment method. Never available for live keys. */
export async function confirmStripeTestPayment(idempotencyKey: string): Promise<
  | { success: true; receipt: CheckoutReceipt }
  | { success: false; error: string; alreadyPaid?: boolean; receipt?: CheckoutReceipt }
> {
  const stripe = getStripeConfig();
  if (stripe.mode !== "test" || !stripe.configured || !hasPaymentAdminClient()) {
    return { success: false, error: "Stripe TEST confirmation is unavailable." };
  }
  if (!uuid.test(idempotencyKey)) return { success: false, error: "Refresh checkout before trying again." };
  const status = await stripePaymentStatus(idempotencyKey);
  if ("error" in status && status.error) return { success: false, error: status.error };
  if (!status.receipt) return { success: false, error: "We could not find this checkout in the current session." };
  if (status.receipt.payment_status === "paid") {
    return { success: false, alreadyPaid: true, error: "This order is already paid. Your confirmation is ready.", receipt: status.receipt };
  }
  const order = await loadOrderById(status.receipt.order_id);
  if (!order) return { success: false, error: "The order could not be loaded for payment." };
  if (order.is_demo || order.payment_provider === "demo" || order.payment_status === "demo") {
    return { success: false, error: "This is a demonstration order." };
  }
  const intentId = order.provider_payment_id;
  if (!intentId || !intentId.startsWith("pi_")) {
    return { success: false, error: "Start card payment first, then confirm the test charge." };
  }
  try {
    const client = stripeClient();
    let intent = await client.paymentIntents.retrieve(intentId);
    const action = nextStripeIntentAction({ orderPaid: order.payment_status === "paid", intentStatus: intent.status });
    if (action === "already_paid" || intent.status === "succeeded") {
      await applyVerifiedPayment({
        orderId: order.id,
        provider: "stripe",
        status: "paid",
        amountCents: intent.amount_received || intent.amount,
        providerPaymentId: intent.id,
      });
      return { success: true, receipt: { ...status.receipt, payment_status: "paid", payment_provider: "stripe", payment_method: "card" } };
    }
    if (action === "wait") {
      return { success: false, error: "This payment is still processing. Refresh in a moment. Do not pay again." };
    }
    if (intent.status === "requires_payment_method" || intent.status === "requires_confirmation") {
      const host = (process.env.VERCEL_URL || "").replace(/^https?:\/\//, "");
      const returnUrl = host ? `https://${host}/checkout` : "https://ivoireshop-steel.vercel.app/checkout";
      intent = await client.paymentIntents.confirm(intent.id, {
        payment_method: "pm_card_visa",
        return_url: returnUrl,
      });
    } else {
      return { success: false, error: "This PaymentIntent cannot accept a test-card confirmation right now." };
    }
    if (intent.status !== "succeeded") {
      return { success: false, error: "Stripe TEST confirmation did not succeed. Try the Payment Element with card 4242." };
    }
    await applyVerifiedPayment({
      orderId: order.id,
      provider: "stripe",
      status: "paid",
      amountCents: intent.amount_received || intent.amount,
      providerPaymentId: intent.id,
    });
    return { success: true, receipt: { ...status.receipt, payment_status: "paid", payment_provider: "stripe", payment_method: "card" } };
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    const code = typeof error === "object" && error && "code" in error ? String((error as { code?: string }).code || "") : "";
    const type = typeof error === "object" && error && "type" in error ? String((error as { type?: string }).type || "") : "";
    if (message && message.length < 180 && !/sk_live|sk_test|whsec_|eyJ|rk_/.test(message)) {
      return { success: false, error: message };
    }
    if (code || type) {
      return { success: false, error: `Stripe TEST confirmation failed (${[type, code].filter(Boolean).join("/")}). Try the Payment Element with card 4242.` };
    }
    return { success: false, error: "Stripe TEST confirmation failed. Please try again." };
  }
}

export async function refundStripeOrder(orderId: string, confirm: string) {
  await requireAdmin();
  if (confirm !== "REFUND") return { error: "Type REFUND to confirm." };
  if (!uuid.test(orderId)) return { error: "Invalid order." };
  const order = await loadOrderById(orderId);
  if (!order) return { error: "Order not found." };
  if (order.is_demo || order.payment_provider === "demo" || order.payment_status === "demo") return { error: "Demo orders cannot be refunded in Stripe." };
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
