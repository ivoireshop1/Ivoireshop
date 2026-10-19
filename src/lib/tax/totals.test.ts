import assert from "node:assert/strict";
import { test } from "node:test";
import { computeTaxCents, computeTaxLines, taxSettingsFromRow } from "./totals.ts";

test("legacy manual tax still computes a single line", () => {
  const tax = taxSettingsFromRow({ tax_mode: "manual_rate", tax_rate_percent: 8, tax_applies_to_shipping: false, tax_name: "Tax" });
  const cents = computeTaxCents({ subtotalCents: 2248, discountCents: 0, shippingCents: 850, tax });
  assert.equal(cents, 180);
});

test("tax 1 and tax 2 can apply independently", () => {
  const tax = taxSettingsFromRow({
    tax_1_enabled: true,
    tax_1_name: "State",
    tax_1_rate_percent: 6,
    tax_1_applies_to_shipping: false,
    tax_2_enabled: true,
    tax_2_name: "Local",
    tax_2_rate_percent: 2,
    tax_2_applies_to_shipping: true,
  });
  const lines = computeTaxLines({ subtotalCents: 10000, discountCents: 0, shippingCents: 500, tax });
  assert.equal(lines.length, 2);
  assert.equal(lines[0].cents, 600);
  assert.equal(lines[1].cents, 210);
  assert.equal(computeTaxCents({ subtotalCents: 10000, discountCents: 0, shippingCents: 500, tax }), 810);
});

test("neither tax collects zero", () => {
  const tax = taxSettingsFromRow({
    tax_1_enabled: false,
    tax_2_enabled: false,
    tax_mode: "no_tax",
  });
  assert.equal(computeTaxCents({ subtotalCents: 5000, discountCents: 0, shippingCents: 800, tax }), 0);
});

test("dual-tax false columns keep explicit not_configured", () => {
  const tax = taxSettingsFromRow({
    tax_mode: "not_configured",
    tax_rate_percent: null,
    tax_1_enabled: false,
    tax_1_rate_percent: null,
    tax_2_enabled: false,
    tax_2_rate_percent: null,
  });
  assert.equal(tax.tax_mode, "not_configured");
  assert.equal(tax.rules?.[0]?.rate_percent, null);
  assert.equal(tax.rules?.[1]?.rate_percent, null);
});
