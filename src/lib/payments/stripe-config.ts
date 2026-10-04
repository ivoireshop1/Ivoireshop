/**
 * Server-only Stripe configuration.
 * Required Vercel/server env (never commit values):
 *   STRIPE_SECRET_KEY              sk_test_... then sk_live_... after owner activation
 *   NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY  pk_test_... / pk_live_...
 *   STRIPE_WEBHOOK_SECRET          whsec_... for POST /api/payments/stripe/webhook
 * Inventory: create_checkout_order decrements stock when the unpaid Stripe order is created.
 * Stock is restored only if payment is cancelled (or the unpaid order is cancelled). Failed cards keep the reservation for retry.
 */
function text(name: string) {
  return (process.env[name] ?? "").trim();
}

export type StripeMode = "test" | "live";

export const STRIPE_ENV_NAMES = {
  secret: "STRIPE_SECRET_KEY",
  publishable: "NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY",
  webhook: "STRIPE_WEBHOOK_SECRET",
} as const;

export function stripeKeyMode(value: string): StripeMode | null {
  if (value.startsWith("sk_live") || value.startsWith("pk_live")) return "live";
  if (value.startsWith("sk_test") || value.startsWith("pk_test")) return "test";
  return null;
}

export function getStripeConfig() {
  const secretKey = text(STRIPE_ENV_NAMES.secret);
  const publishableKey = text(STRIPE_ENV_NAMES.publishable);
  const webhookSecret = text(STRIPE_ENV_NAMES.webhook);
  const secretPresent = Boolean(secretKey);
  const publishablePresent = Boolean(publishableKey);
  const webhookPresent = Boolean(webhookSecret);
  const secretMode = stripeKeyMode(secretKey);
  const publishableMode = stripeKeyMode(publishableKey);
  const modeMismatch = Boolean(secretPresent && publishablePresent && (secretMode !== publishableMode || !secretMode || !publishableMode));
  const mode = !modeMismatch && secretMode && publishableMode ? secretMode : null;
  const canCollect = Boolean(secretPresent && publishablePresent && mode);
  const configured = Boolean(canCollect && webhookPresent);
  const missingNames: string[] = [];
  if (!publishablePresent) missingNames.push(STRIPE_ENV_NAMES.publishable);
  if (!secretPresent) missingNames.push(STRIPE_ENV_NAMES.secret);
  if (!webhookPresent) missingNames.push(STRIPE_ENV_NAMES.webhook);
  return {
    secretKey,
    publishableKey,
    webhookSecret,
    secretPresent,
    publishablePresent,
    webhookPresent,
    modeMismatch,
    mode,
    canCollect,
    configured,
    public: canCollect ? { publishableKey, mode } : null,
    envNames: [STRIPE_ENV_NAMES.secret, STRIPE_ENV_NAMES.publishable, STRIPE_ENV_NAMES.webhook] as const,
    missingNames,
    apiVersion: "2026-09-30.endive" as const,
  };
}

export function stripeDashboardPaymentUrl(mode: StripeMode | null | undefined, paymentIntentId?: string | null) {
  if (!paymentIntentId || !mode) return "";
  const prefix = mode === "live" ? "https://dashboard.stripe.com" : "https://dashboard.stripe.com/test";
  return `${prefix}/payments/${encodeURIComponent(paymentIntentId)}`;
}
