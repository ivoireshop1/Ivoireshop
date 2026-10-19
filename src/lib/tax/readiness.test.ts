import assert from "node:assert/strict";
import { test } from "node:test";
import { isStagingSupabaseEnv, taxReadyForPaidCheckout, type TaxReadinessSettings } from "./readiness.ts";

const notConfigured: TaxReadinessSettings = {
  tax_mode: "not_configured",
  tax_rate_percent: null,
  rules: [],
};

const manualReady: TaxReadinessSettings = {
  tax_mode: "manual_rate",
  tax_rate_percent: 4,
  rules: [{ enabled: true, rate_percent: 4 }],
};

const manualIncomplete: TaxReadinessSettings = {
  tax_mode: "manual_rate",
  tax_rate_percent: null,
  rules: [{ enabled: true, rate_percent: null }],
};

test("production blocks paid checkout while tax is not_configured", () => {
  const env = {
    NEXT_PUBLIC_SUPABASE_URL: "https://lidqskyavlkzwerpncxa.supabase.co",
  };
  assert.equal(taxReadyForPaidCheckout(notConfigured, { stripeMode: "test", env }).ok, false);
  assert.equal(taxReadyForPaidCheckout(notConfigured, { stripeMode: "live", env }).ok, false);
});

test("staging Stripe TEST may proceed without tax config", () => {
  const env = {
    NEXT_PUBLIC_SUPABASE_URL: "https://ixbzrdcsjwaasulkgkbw.supabase.co",
  };
  assert.equal(isStagingSupabaseEnv(env), true);
  const ready = taxReadyForPaidCheckout(notConfigured, { stripeMode: "test", env });
  assert.equal(ready.ok, true);
  if (ready.ok) assert.equal(ready.stagingTestBypass, true);
  assert.equal(taxReadyForPaidCheckout(notConfigured, { stripeMode: "live", env }).ok, false);
});

test("manual_rate requires at least one enabled rate", () => {
  assert.equal(taxReadyForPaidCheckout(manualReady, { stripeMode: "live" }).ok, true);
  assert.equal(taxReadyForPaidCheckout(manualIncomplete, { stripeMode: "live" }).ok, false);
});

test("explicit no_tax is treated as configured", () => {
  const noTax: TaxReadinessSettings = {
    tax_mode: "no_tax",
    tax_rate_percent: null,
    rules: [],
  };
  assert.equal(taxReadyForPaidCheckout(noTax, { stripeMode: "live" }).ok, true);
});
