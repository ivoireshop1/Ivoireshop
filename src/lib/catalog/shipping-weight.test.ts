import assert from "node:assert/strict";
import { test } from "node:test";
import {
  canPersistEstimatedShippingWeight,
  estimatedWeightsAllowed,
  extractWeightOzFromText,
  mapAiOriginToSource,
  quoteUnitWeightLb,
  shippingPatchFromSuggestion,
} from "./shipping-weight.ts";

test("title and multi-pack text extract to ounces without changing selling method", () => {
  assert.equal(extractWeightOzFromText("ELEPHANT BRAND rice POIDS NET 25 LBS")?.weightOz, 400);
  assert.equal(extractWeightOzFromText("Golden Tropics Cocoyam Fufu 680G")?.weightOz, 23.986);
  assert.equal(extractWeightOzFromText("Water 12 x 1L")?.weightOz, 423.288);
  assert.equal(extractWeightOzFromText("Peak milk") , null);
});

test("AI sources map to stored weight_source values", () => {
  assert.equal(mapAiOriginToSource("text"), "ai_text");
  assert.equal(mapAiOriginToSource("image"), "ai_image");
  assert.equal(mapAiOriginToSource("estimate"), "ai_estimate");
});

test("quotes use AI weight plus packaging plus a 10% buffer", () => {
  const quoted = quoteUnitWeightLb({
    weight_oz: 160,
    packaging_weight_oz: 16,
    weight_source: "ai_image",
  }, { ALLOW_ESTIMATED_WEIGHTS: "true" });
  assert.equal(quoted, 12.1);
});

test("verified weights do not get the estimate buffer", () => {
  assert.equal(quoteUnitWeightLb({
    item_weight_lb: 25,
    weight_source: "verified",
  }, { ALLOW_ESTIMATED_WEIGHTS: "true" }), 25);
});

test("ALLOW_ESTIMATED_WEIGHTS=false blocks ai_* and keeps verified", () => {
  const env = { ALLOW_ESTIMATED_WEIGHTS: "false" };
  assert.equal(estimatedWeightsAllowed(env), false);
  assert.equal(quoteUnitWeightLb({ weight_oz: 80, weight_source: "ai_estimate" }, env), null);
  assert.equal(quoteUnitWeightLb({ weight_oz: 80, weight_source: "verified" }, env), 5);
});

test("AI sources stay estimates and never overwrite a verified weight", () => {
  assert.equal(canPersistEstimatedShippingWeight({ weight_source: "verified" }), false);
  assert.equal(canPersistEstimatedShippingWeight({ weight_source: "ai_estimate" }), true);
  assert.equal(canPersistEstimatedShippingWeight({ weight_source: null }), true);
  const estimated = quoteUnitWeightLb({
    weight_oz: 160,
    packaging_weight_oz: 16,
    weight_source: "ai_estimate",
  }, { ALLOW_ESTIMATED_WEIGHTS: "true" });
  const verified = quoteUnitWeightLb({
    item_weight_lb: 10,
    weight_source: "verified",
  }, { ALLOW_ESTIMATED_WEIGHTS: "true" });
  assert.equal(estimated, 12.1);
  assert.equal(verified, 10);
});

test("manual save patch keeps selling-method fields out of the shipping write", () => {
  const patch = shippingPatchFromSuggestion({
    weightOz: 400,
    lengthIn: 18,
    widthIn: 12,
    heightIn: 6,
    source: "verified",
    confidence: "high",
  });
  assert.equal(patch.item_weight_lb, 25);
  assert.equal(patch.ship_length_in, 18);
  assert.equal("selling_method" in patch, false);
  assert.equal("price" in patch, false);
});
