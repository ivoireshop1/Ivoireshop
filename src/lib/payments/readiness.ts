import { getStripeConfig } from "./stripe-config";
import { hasPaymentAdminClient } from "./config";
import { toPublicPaymentConfig, type PublicPaymentConfig } from "./customer-copy";
import { createClient } from "@/src/lib/supabase/server";
import { STORE_SETTINGS_ID } from "@/src/lib/store/constants";
import { taxSettingsFromRow } from "@/src/lib/tax/totals";
import { TAX_PAYMENT_BLOCKED_MESSAGE, taxReadyForPaidCheckout } from "@/src/lib/tax/readiness";

export { CUSTOMER_CARD_UNAVAILABLE, customerPaymentMessage, toPublicPaymentConfig } from "./customer-copy";
export type { PublicPaymentConfig } from "./customer-copy";

export function getPaymentReadiness(input?: {
  taxBlocked?: boolean;
  taxBlockedMessage?: string;
}) {
  const stripe = getStripeConfig();
  const canRecord = hasPaymentAdminClient();
  const taxBlocked = input?.taxBlocked === true;
  const stripeReady = stripe.configured && canRecord && !taxBlocked;
  const missing: string[] = [...stripe.missingNames];
  if (!canRecord) missing.push("SUPABASE_SERVICE_ROLE_KEY");
  const testMode = stripeReady && stripe.mode === "test";
  return {
    enabled: stripeReady,
    mode: stripeReady ? ("online" as const) : ("unavailable" as const),
    canRecord,
    taxBlocked,
    stripe: {
      configured: stripe.configured,
      canCollect: stripe.canCollect && !taxBlocked,
      ready: stripeReady,
      mode: stripe.mode,
      livePaymentsEnabled: stripe.livePaymentsEnabled,
      liveBlocked: stripe.liveBlocked,
      label: taxBlocked
        ? "Tax lock"
        : stripe.liveBlocked
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
      invalidKeyType: stripe.invalidKeyType,
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
    message: taxBlocked
      ? (input?.taxBlockedMessage ?? TAX_PAYMENT_BLOCKED_MESSAGE)
      : stripe.liveBlocked
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

export async function getPublicPaymentConfig(): Promise<PublicPaymentConfig> {
  const stripe = getStripeConfig();
  let taxBlocked = false;
  try {
    const supabase = await createClient();
    const { data: store } = await supabase.from("store_settings").select("*").eq("id", STORE_SETTINGS_ID).maybeSingle();
    const tax = taxSettingsFromRow(store as Record<string, unknown> | null);
    taxBlocked = !taxReadyForPaidCheckout(tax, { stripeMode: stripe.mode }).ok;
  } catch {
    // Fail closed for paid checkout UI when tax settings cannot be read.
    taxBlocked = true;
  }
  const payment = getPaymentReadiness({
    taxBlocked,
    taxBlockedMessage: TAX_PAYMENT_BLOCKED_MESSAGE,
  });
  return toPublicPaymentConfig({
    ready: payment.stripe.configured && payment.canRecord && !taxBlocked,
    mode: payment.stripe.mode,
    liveBlocked: payment.stripe.liveBlocked,
    taxBlocked,
    taxBlockedMessage: TAX_PAYMENT_BLOCKED_MESSAGE,
  });
}
