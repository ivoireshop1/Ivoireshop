/** Staging Supabase project used for isolated Stripe TEST verification. */
const STAGING_SUPABASE_REF = "ixbzrdcsjwaasulkgkbw";

export const TAX_PAYMENT_BLOCKED_MESSAGE =
  "Online payment is unavailable until sales tax is configured and verified for your area. You can still browse, use your cart, and contact the store for help.";

export type TaxReadinessSettings = {
  tax_mode: "not_configured" | "no_tax" | "manual_rate";
  tax_rate_percent?: number | null;
  rules?: Array<{
    enabled: boolean;
    rate_percent: number | null;
  }>;
};

export function isStagingSupabaseEnv(env: NodeJS.ProcessEnv = process.env) {
  const url = `${env.NEXT_PUBLIC_SUPABASE_URL ?? ""} ${env.SUPABASE_URL ?? ""}`;
  return url.includes(STAGING_SUPABASE_REF);
}

function hasEnabledManualRate(tax: TaxReadinessSettings) {
  if (tax.tax_rate_percent != null && Number.isFinite(tax.tax_rate_percent) && tax.tax_rate_percent >= 0) {
    return true;
  }
  return Boolean(
    tax.rules?.some(
      (rule) => rule.enabled && rule.rate_percent != null && Number.isFinite(rule.rate_percent) && rule.rate_percent >= 0,
    ),
  );
}

/**
 * Real paid checkout requires an explicit tax configuration.
 * Staging Stripe TEST may bypass only while tax is still being prepared.
 */
export function taxReadyForPaidCheckout(
  tax: TaxReadinessSettings,
  input: { stripeMode: "test" | "live" | null; env?: NodeJS.ProcessEnv } = { stripeMode: null },
): { ok: true; stagingTestBypass?: boolean } | { ok: false; reason: "tax_not_configured" | "tax_incomplete" } {
  const env = input.env ?? process.env;
  if (tax.tax_mode === "not_configured") {
    if (input.stripeMode === "test" && isStagingSupabaseEnv(env)) {
      return { ok: true, stagingTestBypass: true };
    }
    return { ok: false, reason: "tax_not_configured" };
  }
  if (tax.tax_mode === "manual_rate" && !hasEnabledManualRate(tax)) {
    return { ok: false, reason: "tax_incomplete" };
  }
  return { ok: true };
}
