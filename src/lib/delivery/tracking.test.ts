import assert from "node:assert/strict";
import { test } from "node:test";
import {
  looksLikeUpsTracking,
  looksLikeUspsTracking,
  trackingUrl,
  validateCarrierTracking,
} from "./tracking.ts";

test("accepts common UPS formats without inventing numbers", () => {
  assert.equal(looksLikeUpsTracking("1Z999AA10123456784"), true);
  assert.equal(validateCarrierTracking("ups", "1z999aa10123456784").ok, true);
  assert.equal(validateCarrierTracking("ups", "abc").ok, false);
});

test("accepts common USPS formats including newer long numeric labels", () => {
  assert.equal(looksLikeUspsTracking("9400111899562537875310"), true);
  assert.equal(looksLikeUspsTracking("EA123456789US"), true);
  assert.equal(validateCarrierTracking("usps", "9400111899562537875310").ok, true);
  assert.equal(validateCarrierTracking("usps", "short").ok, false);
});

test("official tracker destinations are UPS and USPS only", () => {
  assert.equal(
    trackingUrl("ups", "1Z999AA10123456784"),
    "https://www.ups.com/track?tracknum=1Z999AA10123456784",
  );
  assert.equal(
    trackingUrl("usps", "9400111899562537875310"),
    "https://tools.usps.com/go/TrackConfirmAction?tLabels=9400111899562537875310",
  );
  assert.equal(trackingUrl("store", "1Z999AA10123456784"), "");
});
