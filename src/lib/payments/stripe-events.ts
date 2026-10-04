import "server-only";

import type Stripe from "stripe";
import { applyVerifiedPayment, applyVerifiedRefund, markWebhookHealth } from "./record";

function orderIdFromIntent(intent: Stripe.PaymentIntent) {
  const meta = intent.metadata?.order_id;
  return typeof meta === "string" && meta.length > 10 ? meta : null;
}

export async function processStripeEvent(event: Stripe.Event) {
  try {
    if (event.type === "payment_intent.succeeded") {
      const intent = event.data.object as Stripe.PaymentIntent;
      const orderId = orderIdFromIntent(intent);
      if (!orderId || intent.currency !== "usd") {
        await markWebhookHealth("stripe", true);
        return { ok: true as const };
      }
      await applyVerifiedPayment({
        orderId,
        provider: "stripe",
        status: "paid",
        amountCents: intent.amount_received || intent.amount,
        providerPaymentId: intent.id,
        eventId: event.id,
      });
    } else if (event.type === "payment_intent.payment_failed") {
      const intent = event.data.object as Stripe.PaymentIntent;
      const orderId = orderIdFromIntent(intent);
      if (orderId) {
        await applyVerifiedPayment({
          orderId,
          provider: "stripe",
          status: "failed",
          providerPaymentId: intent.id,
          eventId: event.id,
        });
      }
    } else if (event.type === "payment_intent.canceled") {
      const intent = event.data.object as Stripe.PaymentIntent;
      const orderId = orderIdFromIntent(intent);
      if (orderId) {
        await applyVerifiedPayment({
          orderId,
          provider: "stripe",
          status: "cancelled",
          providerPaymentId: intent.id,
          eventId: event.id,
        });
      }
    } else if (event.type === "charge.refunded") {
      const charge = event.data.object as Stripe.Charge;
      const intentId = typeof charge.payment_intent === "string" ? charge.payment_intent : charge.payment_intent?.id;
      const orderId = charge.metadata?.order_id || (intentId ? (await loadOrderByPaymentIntent(intentId)) : null);
      if (orderId && charge.currency === "usd") {
        await applyVerifiedRefund({
          orderId,
          provider: "stripe",
          refundedCents: charge.amount_refunded ?? 0,
          eventId: event.id,
          providerPaymentId: intentId ?? charge.id,
        });
      }
    } else if (event.type === "charge.dispute.created") {
      const dispute = event.data.object as Stripe.Dispute;
      const charge = typeof dispute.charge === "string" ? dispute.charge : dispute.charge?.id;
      await markWebhookHealth("stripe", true);
      console.info("[stripe-dispute]", { charge: charge ? "present" : "missing" });
    }
    await markWebhookHealth("stripe", true);
    return { ok: true as const };
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (message.includes("does not match")) {
      await markWebhookHealth("stripe", false, "amount_mismatch");
      throw error;
    }
    await markWebhookHealth("stripe", false, "process_failed");
    throw error;
  }
}

async function loadOrderByPaymentIntent(paymentIntentId: string) {
  const { requireAdminClient } = await import("./record");
  const supabase = requireAdminClient();
  const { data } = await supabase.from("orders").select("id").eq("provider_payment_id", paymentIntentId).maybeSingle();
  return data?.id ?? null;
}
