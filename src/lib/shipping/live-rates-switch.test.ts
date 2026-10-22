import assert from "node:assert/strict";
import { test } from "node:test";
import { LIVE_RATES_DISABLED_MESSAGE, shippingLiveRatesEnabled } from "./live-rates-switch.ts";

test("live checkout rates stay off unless SHIPPING_LIVE_RATES_ENABLED is explicitly true", () => {
  assert.equal(shippingLiveRatesEnabled({}), false);
  assert.equal(shippingLiveRatesEnabled({ SHIPPING_LIVE_RATES_ENABLED: "false" }), false);
  assert.equal(shippingLiveRatesEnabled({ SHIPPING_LIVE_RATES_ENABLED: "0" }), false);
  assert.equal(shippingLiveRatesEnabled({ SHIPPING_LIVE_RATES_ENABLED: "true" }), true);
  assert.match(LIVE_RATES_DISABLED_MESSAGE, /Store Pickup remains available/);
});
