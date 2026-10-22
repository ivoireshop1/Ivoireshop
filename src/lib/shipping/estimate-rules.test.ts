import assert from "node:assert/strict";
import { test } from "node:test";
import { CATEGORY_SHIPPING_DEFAULTS, categoryEstimateWeightLb, lookupCategoryDefault, producePackagingAllowanceLb } from "./estimate-rules.ts";

test("configured category defaults apply a 10% buffer once and do not invent verified weights", () => {
  assert.equal(CATEGORY_SHIPPING_DEFAULTS["ivoire-market"]?.weightOz, 24);
  assert.equal(categoryEstimateWeightLb("ivoire-market"), 1.65);
  assert.equal(categoryEstimateWeightLb("ivoire-market", CATEGORY_SHIPPING_DEFAULTS, 4), 1.925);
  assert.equal(lookupCategoryDefault("ivoire-market-dairy")?.weightOz, 24);
  assert.equal(lookupCategoryDefault("cosmetics-creams-lotions")?.weightOz, 8);
  assert.equal(categoryEstimateWeightLb("unknown-category"), null);
  assert.equal(categoryEstimateWeightLb("foods", {
    foods: { weightOz: 16, packagingOz: 0, label: "test only" },
  }), 1.1);
});

test("produce packaging uses the saved allowance and does not invent a carton", () => {
  assert.equal(producePackagingAllowanceLb({ selling_method: "weight" }), 0);
  assert.equal(producePackagingAllowanceLb({ selling_method: "weight", packaging_weight_oz: 8 }), 0.5);
});
