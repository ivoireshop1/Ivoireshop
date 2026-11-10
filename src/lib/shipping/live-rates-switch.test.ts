import assert from "node:assert/strict";
import { test } from "node:test";
import { adminCustomerRatesActivated, checkoutLiveQuotesBlocked, LIVE_RATES_DISABLED_MESSAGE, shippingLiveRatesEnabled, shippingLiveRatesSwitch } from "./live-rates-switch.ts";

const easyshipOn = {
  shipping_provider: "easyship",
  easyship_enabled: true,
  easyship_customer_rates_enabled: true,
};

test("explicit live-rate switch values stay strict", () => {
  assert.equal(shippingLiveRatesSwitch({}), "unset");
  assert.equal(shippingLiveRatesSwitch({ SHIPPING_LIVE_RATES_ENABLED: "false" }), "off");
  assert.equal(shippingLiveRatesSwitch({ SHIPPING_LIVE_RATES_ENABLED: "0" }), "off");
  assert.equal(shippingLiveRatesSwitch({ SHIPPING_LIVE_RATES_ENABLED: "true" }), "on");
  assert.equal(shippingLiveRatesEnabled({}), false);
  assert.equal(shippingLiveRatesEnabled({ SHIPPING_LIVE_RATES_ENABLED: "true" }), true);
  assert.match(LIVE_RATES_DISABLED_MESSAGE, /Store Pickup remains available/);
});

test("saved Easyship customer-rate activation is honored when the emergency switch is unset", () => {
  assert.equal(adminCustomerRatesActivated(easyshipOn), true);
  assert.equal(checkoutLiveQuotesBlocked(easyshipOn, {}), false);
  assert.equal(checkoutLiveQuotesBlocked({ ...easyshipOn, easyship_customer_rates_enabled: false }, {}), true);
  assert.equal(checkoutLiveQuotesBlocked(easyshipOn, { SHIPPING_LIVE_RATES_ENABLED: "false" }), true);
  assert.equal(checkoutLiveQuotesBlocked({ shipping_provider: "shippo", shippo_enabled: true }, {}), true);
  assert.equal(checkoutLiveQuotesBlocked({ shipping_provider: "shippo", shippo_enabled: true }, { SHIPPING_LIVE_RATES_ENABLED: "true" }), false);
});
