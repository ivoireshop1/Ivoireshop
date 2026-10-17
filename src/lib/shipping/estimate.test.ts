import assert from "node:assert/strict";
import { test } from "node:test";
import { DEFAULT_IVOIRE_SHIPPING_CONFIG, STORE_SHIPPING_DISCLAIMER, estimateIvoireShipping } from "./estimate.ts";

test("domestic estimate uses weight, base, per-lb, and is labeled store-calculated", () => {
  const quote = estimateIvoireShipping({
    config: DEFAULT_IVOIRE_SHIPPING_CONFIG,
    packages: [{ quantity: 1, ship_weight_lb: 4, ship_length_in: 10, ship_width_in: 8, ship_height_in: 6 }],
    destinationCountry: "US",
  });
  assert.ok(quote);
  assert.equal(quote?.usedFallback, false);
  assert.ok((quote?.amount ?? 0) > 8.5);
  assert.match(quote?.explanation ?? "", /Store-calculated/);
  assert.match(STORE_SHIPPING_DISCLAIMER, /not a live UPS or USPS quote/i);
});

test("over max weight uses fallback instead of inventing a carrier price", () => {
  const quote = estimateIvoireShipping({
    config: { ...DEFAULT_IVOIRE_SHIPPING_CONFIG, max_weight_lb: 5 },
    packages: [{ quantity: 1, ship_weight_lb: 40 }],
    destinationCountry: "US",
  });
  assert.equal(quote?.usedFallback, true);
  assert.equal(quote?.amount, DEFAULT_IVOIRE_SHIPPING_CONFIG.fallback_amount);
});
