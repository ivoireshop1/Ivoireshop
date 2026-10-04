import { getStripeConfig } from "./stripe-config";
import { hasPaymentAdminClient } from "./config";

export function getPaymentReadiness() {
  const stripe = getStripeConfig();
  const canRecord = hasPaymentAdminClient();
  const stripeReady = stripe.canCollect && canRecord;
  const missing: string[] = [...stripe.missingNames];
  if (!canRecord) missing.push("SUPABASE_SERVICE_ROLE_KEY");
  return {
    enabled: stripeReady,
    mode: stripeReady ? ("online" as const) : ("unavailable" as const),
    canRecord,
    stripe: {
      configured: stripe.configured,
      canCollect: stripe.canCollect,
      ready: stripeReady,
      mode: stripe.mode,
      label: stripe.canCollect ? (stripe.mode === "live" ? "Live" : "Test") : "Not configured",
      publishable: stripe.publishablePresent ? ("available" as const) : ("missing" as const),
      server: stripe.secretPresent ? ("available" as const) : ("missing" as const),
      webhook: stripe.webhookPresent ? ("configured" as const) : ("missing" as const),
      modeMismatch: stripe.modeMismatch,
      missing,
      public: stripe.public,
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
    message: stripeReady
      ? stripe.webhookPresent
        ? "Pay securely with Stripe. The charged amount is always the store-confirmed order total."
        : "Stripe keys are present. Add STRIPE_WEBHOOK_SECRET so paid orders can be confirmed."
      : missing.length
        ? `Stripe checkout is waiting for: ${missing.join(", ")}.`
        : "Online payment is not available.",
  };
}

export type PublicPaymentConfig = ReturnType<typeof getPaymentReadiness>;
