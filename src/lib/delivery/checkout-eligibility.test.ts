import assert from "node:assert/strict";
import test from "node:test";
import {
  IVOIRE_SHIPPING_RETIRED_MESSAGE,
  isCheckoutEligibleShippingOption,
  isRetiredIvoireShippingSelection,
} from "./checkout-eligibility.ts";
import { resolveSelectedShippingOption } from "../shipping/shippo.ts";

test("retired Ivoire shipping ids are detected", () => {
  assert.equal(isRetiredIvoireShippingSelection("ivoire:estimate"), true);
  assert.equal(isRetiredIvoireShippingSelection("IVOIRE:estimate"), true);
  assert.equal(isRetiredIvoireShippingSelection("pickup"), false);
});

test("checkout eligibility keeps pickup and live carriers only", () => {
  assert.equal(isCheckoutEligibleShippingOption({
    provider: "pickup",
    fulfillmentMethod: "local_pickup",
  }), true);
  assert.equal(isCheckoutEligibleShippingOption({
    provider: "ups",
    fulfillmentMethod: "delivery",
    rateMode: "live_api",
  }), true);
  assert.equal(isCheckoutEligibleShippingOption({
    provider: "ups",
    fulfillmentMethod: "delivery",
    rateMode: "store_rate",
  }), false);
  assert.equal(isCheckoutEligibleShippingOption({
    provider: "ivoire",
    fulfillmentMethod: "delivery",
    rateMode: "store_rate",
  }), false);
});

test("server rejects stale Ivoire Shop Shipping selections", () => {
  const rejected = resolveSelectedShippingOption(
    [{
      id: "pickup",
      provider: "pickup",
      fulfillmentMethod: "local_pickup" as const,
      amount: 0,
    }],
    "ivoire:estimate",
    "delivery",
    23.25,
  );
  assert.equal("error" in rejected, true);
  if ("error" in rejected) {
    assert.match(rejected.error, /Ivoire Shop Shipping is no longer available/);
    assert.equal(rejected.stale, true);
  }
  assert.match(IVOIRE_SHIPPING_RETIRED_MESSAGE, /no longer available/);
});

test("server rejects store-rate UPS even if present in options", () => {
  const rejected = resolveSelectedShippingOption(
    [{
      id: "ups:manual:domestic",
      provider: "ups",
      fulfillmentMethod: "delivery" as const,
      amount: 12,
      rateMode: "store_rate",
    }],
    "ups:manual:domestic",
    "delivery",
    12,
  );
  assert.equal("error" in rejected, true);
  if ("error" in rejected) {
    assert.match(rejected.error, /live UPS or USPS/);
  }
});
