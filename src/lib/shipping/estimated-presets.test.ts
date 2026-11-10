import assert from "node:assert/strict";
import { test } from "node:test";
import { ESTIMATED_PACKAGING_PRESETS, isEstimatedPackageId, withEstimateAllowanceLb } from "./estimated-presets.ts";

test("estimated packaging presets stay labeled estimates with the required sizes", () => {
  assert.deepEqual(
    ESTIMATED_PACKAGING_PRESETS.map((preset) => [
      preset.id,
      preset.lengthIn,
      preset.widthIn,
      preset.heightIn,
      preset.maxWeightLb,
      preset.estimated,
    ]),
    [
      ["estimate-small-mailer", 10, 8, 4, 2, true],
      ["estimate-small-box", 12, 10, 6, 5, true],
      ["estimate-medium-box", 16, 12, 10, 15, true],
      ["estimate-large-box", 20, 16, 12, 30, true],
      ["estimate-heavy-box", 26, 18, 10, 50, true],
    ],
  );
  assert.equal(isEstimatedPackageId("estimate-large-box"), true);
  assert.equal(isEstimatedPackageId("pkg-small"), false);
});

test("estimate allowance applies 10% once and never double-buffers", () => {
  assert.equal(withEstimateAllowanceLb(25.25, false), 27.775);
  assert.equal(withEstimateAllowanceLb(1.925, true), 1.925);
  assert.equal(withEstimateAllowanceLb(50.25, false), 55.275);
});
