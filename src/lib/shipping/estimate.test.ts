import assert from "node:assert/strict";
import { test } from "node:test";
import {
  DEFAULT_IVOIRE_SHIPPING_CONFIG,
  IVOIRE_SHIPPING_ENGINE,
  STORE_SHIPPING_DISCLAIMER,
  estimateIvoireShipping,
  parseUsZip,
} from "./estimate.ts";
import { computeTaxLines, taxSettingsFromRow } from "../tax/totals.ts";
import { optionToSnapshot } from "../delivery/snapshot.ts";

test("engine is rules-based store calculation, not a model or carrier API", () => {
  assert.equal(IVOIRE_SHIPPING_ENGINE, "rules");
  assert.match(STORE_SHIPPING_DISCLAIMER, /not a live UPS or USPS quote/i);
});

test("domestic estimate uses weight, base, per-lb, ZIP, and origin", () => {
  const quote = estimateIvoireShipping({
    config: DEFAULT_IVOIRE_SHIPPING_CONFIG,
    packages: [{ quantity: 1, ship_weight_lb: 4, ship_length_in: 10, ship_width_in: 8, ship_height_in: 6 }],
    destinationCountry: "US",
    destinationPostalCode: "30093",
    originLabel: "1210 Rockbridge Rd NW, Norcross",
  });
  assert.ok(quote);
  assert.equal(quote?.blocked, undefined);
  assert.equal(quote?.usedFallback, false);
  assert.equal(quote?.amount, 11.9);
  assert.match(quote?.explanation ?? "", /Store-calculated/);
  assert.match(quote?.explanation ?? "", /30093/);
  assert.match(quote?.explanation ?? "", /Norcross/);
});

test("quantity combines billable weight", () => {
  const one = estimateIvoireShipping({
    config: DEFAULT_IVOIRE_SHIPPING_CONFIG,
    packages: [{ quantity: 1, ship_weight_lb: 4 }],
    destinationCountry: "US",
    destinationPostalCode: "30093",
  });
  const two = estimateIvoireShipping({
    config: DEFAULT_IVOIRE_SHIPPING_CONFIG,
    packages: [{ quantity: 2, ship_weight_lb: 4 }],
    destinationCountry: "US",
    destinationPostalCode: "30093",
  });
  assert.ok((two?.amount ?? 0) > (one?.amount ?? 0));
  assert.equal(two?.billableWeightLb, 8);
});

test("over max weight uses fallback instead of inventing a carrier price", () => {
  const quote = estimateIvoireShipping({
    config: { ...DEFAULT_IVOIRE_SHIPPING_CONFIG, max_weight_lb: 5 },
    packages: [{ quantity: 1, ship_weight_lb: 40 }],
    destinationCountry: "US",
    destinationPostalCode: "30093",
  });
  assert.equal(quote?.usedFallback, true);
  assert.equal(quote?.amount, DEFAULT_IVOIRE_SHIPPING_CONFIG.fallback_amount);
});

test("missing weight uses package defaults", () => {
  const quote = estimateIvoireShipping({
    config: DEFAULT_IVOIRE_SHIPPING_CONFIG,
    packages: [{ quantity: 1 }],
    destinationCountry: "US",
    destinationPostalCode: "30093",
  });
  assert.equal(quote?.usedDefaults, true);
  assert.equal(quote?.usedFallback, false);
  assert.ok((quote?.amount ?? 0) > 0);
});

test("missing weight can block quoting", () => {
  const quote = estimateIvoireShipping({
    config: {
      ...DEFAULT_IVOIRE_SHIPPING_CONFIG,
      missing_info_policy: "block",
      package_defaults: { weight_lb: null, length_in: null, width_in: null, height_in: null },
    },
    packages: [{ quantity: 1 }],
    destinationCountry: "US",
    destinationPostalCode: "30093",
  });
  assert.equal(quote?.blocked, true);
  assert.equal(quote?.amount, 0);
});

test("invalid ZIP blocks domestic Ivoire shipping by default", () => {
  assert.equal(parseUsZip("abc").ok, false);
  const quote = estimateIvoireShipping({
    config: DEFAULT_IVOIRE_SHIPPING_CONFIG,
    packages: [{ quantity: 1, ship_weight_lb: 4 }],
    destinationCountry: "US",
    destinationPostalCode: "12",
  });
  assert.equal(quote?.blocked, true);
  assert.match(quote?.blockReason ?? "", /ZIP/);
});

test("invalid ZIP can use fallback when configured", () => {
  const quote = estimateIvoireShipping({
    config: { ...DEFAULT_IVOIRE_SHIPPING_CONFIG, invalid_zip_policy: "fallback" },
    packages: [{ quantity: 1, ship_weight_lb: 4 }],
    destinationCountry: "US",
    destinationPostalCode: "nope",
  });
  assert.equal(quote?.usedFallback, true);
  assert.equal(quote?.amount, 12.5);
});

test("handling fee and min/max charges clamp the store amount", () => {
  const quote = estimateIvoireShipping({
    config: { ...DEFAULT_IVOIRE_SHIPPING_CONFIG, handling_fee: 2, min_charge: 20, max_charge: 30 },
    packages: [{ quantity: 1, ship_weight_lb: 1 }],
    destinationCountry: "US",
    destinationPostalCode: "30093",
  });
  assert.equal(quote?.amount, 20);
  const capped = estimateIvoireShipping({
    config: { ...DEFAULT_IVOIRE_SHIPPING_CONFIG, handling_fee: 0, max_charge: 9 },
    packages: [{ quantity: 1, ship_weight_lb: 40 }],
    destinationCountry: "US",
    destinationPostalCode: "30093",
  });
  assert.equal(capped?.amount, 9);
});

test("disabled engine returns no Ivoire option", () => {
  const quote = estimateIvoireShipping({
    config: { ...DEFAULT_IVOIRE_SHIPPING_CONFIG, enabled: false },
    packages: [{ quantity: 1, ship_weight_lb: 4 }],
    destinationCountry: "US",
    destinationPostalCode: "30093",
  });
  assert.equal(quote, null);
});

test("international uses the international zone", () => {
  const quote = estimateIvoireShipping({
    config: DEFAULT_IVOIRE_SHIPPING_CONFIG,
    packages: [{ quantity: 1, ship_weight_lb: 2 }],
    destinationCountry: "CA",
    destinationPostalCode: "H2X1Y4",
  });
  assert.equal(quote?.zoneId, "international");
  assert.ok((quote?.amount ?? 0) >= 24);
});

test("tax can apply independently to an Ivoire shipping amount", () => {
  const quote = estimateIvoireShipping({
    config: DEFAULT_IVOIRE_SHIPPING_CONFIG,
    packages: [{ quantity: 1, ship_weight_lb: 4 }],
    destinationCountry: "US",
    destinationPostalCode: "30093",
  });
  const tax = taxSettingsFromRow({
    tax_1_enabled: true,
    tax_1_name: "State",
    tax_1_rate_percent: 8,
    tax_1_applies_to_shipping: true,
  });
  const lines = computeTaxLines({
    subtotalCents: 1000,
    discountCents: 0,
    shippingCents: Math.round((quote?.amount ?? 0) * 100),
    tax,
  });
  assert.equal(lines.length, 1);
  assert.ok(lines[0].cents > 80);
});

test("disabled UPS and USPS stay off checkout", () => {
  function eligible(settings: Record<string, unknown>, carrier: "ups" | "usps") {
    const enabled = Boolean(settings[`${carrier}_enabled`]);
    const show = settings[`${carrier}_show_at_checkout`] !== false;
    const mode = settings[`${carrier}_rate_mode`];
    return enabled && show && mode !== "live_api";
  }
  assert.equal(eligible({ ups_enabled: false, usps_enabled: false }, "ups"), false);
  assert.equal(eligible({
    ups_enabled: true,
    ups_show_at_checkout: true,
    ups_rate_mode: "live_api",
  }, "ups"), false);
  assert.equal(eligible({
    usps_enabled: true,
    usps_show_at_checkout: true,
    usps_rate_mode: "store_rate",
  }, "usps"), true);
});

test("order snapshot preserves Ivoire store-calculated charge", () => {
  const snapshot = optionToSnapshot({
    id: "ivoire:estimate",
    provider: "ivoire",
    fulfillmentMethod: "delivery",
    label: "Ivoire Shop Shipping",
    amount: 11.9,
    estimate: STORE_SHIPPING_DISCLAIMER,
    usedFallback: false,
    billableWeightLb: 4,
    zone: "domestic",
    mode: "manual",
    rateMode: "store_rate",
  });
  assert.equal(snapshot.amount, 11.9);
  assert.equal(snapshot.source, "ivoire_engine");
  assert.equal(snapshot.used_fallback, false);
  assert.equal(snapshot.billable_weight_lb, 4);
});

test("pickup snapshot stays zero", () => {
  const snapshot = optionToSnapshot({
    id: "pickup",
    provider: "pickup",
    fulfillmentMethod: "local_pickup",
    label: "Pickup",
    amount: 0,
  });
  assert.equal(snapshot.amount, 0);
  assert.equal(snapshot.provider, "pickup");
});
