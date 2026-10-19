import { getStripeConfig } from "./stripe-config";
import { hasPaymentAdminClient } from "./config";
import { toPublicPaymentConfig, type PublicPaymentConfig } from "./customer-copy";

export { CUSTOMER_CARD_UNAVAILABLE, customerPaymentMessage, toPublicPaymentConfig } from "./customer-copy";
export type { PublicPaymentConfig } from "./customer-copy";

export function getPaymentReadiness() {
  const stripe = getStripeConfig();
  const canRecord = hasPaymentAdminClient();
  const stripeReady = stripe.configured && canRecord;
  const missing: string[] = [...stripe.missingNames];
  if (!canRecord) missing.push("SUPABASE_SERVICE_ROLE_KEY");
  const testMode = stripeReady && stripe.mode === "test";
  return {
    enabled: stripeReady,
    mode: stripeReady ? ("online" as const) : ("unavailable" as const),
    canRecord,
    stripe: {
      configured: stripe.configured,
      canCollect: stripe.canCollect,
      ready: stripeReady,
      mode: stripe.mode,
      livePaymentsEnabled: stripe.livePaymentsEnabled,
      liveBlocked: stripe.liveBlocked,
      label: stripe.liveBlocked
        ? "Live locked"
        : stripeReady
          ? (stripe.mode === "live" ? "Live" : "Test")
          : stripe.canCollect
            ? "Waiting for webhook and order recording"
            : "Not configured",
      publishable: stripe.publishablePresent ? ("available" as const) : ("missing" as const),
      server: stripe.secretPresent ? ("available" as const) : ("missing" as const),
      webhook: stripe.webhookPresent ? ("configured" as const) : ("missing" as const),
      modeMismatch: stripe.modeMismatch,
      missing,
      public: stripeReady ? stripe.public : null,
    },
    square: {
      configured: false,
      ready: false,
      label: "Retired",
      public: null,
    },
    paypal: {
      configured: false,
      ready: false,
      label: "Retired",
      public: null,
    },
    message: stripe.liveBlocked
      ? "Live card payments are locked until the founder approves activation."
      : stripeReady
        ? testMode
          ? "Stripe TEST MODE. Pay with a test card. This is not a live charge."
          : "Pay securely with Stripe. The charged amount is always the store-confirmed order total."
        : stripe.canCollect && !stripe.webhookPresent
          ? "Stripe keys are present. Add the webhook secret so paid orders can be confirmed."
          : stripe.canCollect && !canRecord
            ? "Stripe keys are present. Order payment recording is not configured on this environment."
            : missing.length
              ? `Card payment is not available yet. Waiting for: ${missing.join(", ")}.`
              : "Card payment is not available yet.",
  };
}

export type PaymentReadiness = ReturnType<typeof getPaymentReadiness>;

export function getPublicPaymentConfig(): PublicPaymentConfig {
  const payment = getPaymentReadiness();
  return toPublicPaymentConfig({
    ready: payment.stripe.ready,
    mode: payment.stripe.mode,
    liveBlocked: payment.stripe.liveBlocked,
  });
}
