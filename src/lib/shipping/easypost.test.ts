import assert from "node:assert/strict";
import { test } from "node:test";
import { mapEasyPostRates } from "./easypost.ts";
import { customerFacingEasyPostAllowed, liveCarrierApiEnabled, parseShippingProvider } from "./provider.ts";

test("shipping provider defaults to Shippo and keeps EasyPost opt-in", () => {
  assert.equal(parseShippingProvider(undefined), "shippo");
  assert.equal(parseShippingProvider("easypost"), "easypost");
  assert.equal(liveCarrierApiEnabled({ shippo_enabled: true }), true);
  assert.equal(liveCarrierApiEnabled({ shipping_provider: "easypost", easypost_enabled: false, shippo_enabled: true }), false);
  assert.equal(liveCarrierApiEnabled({ shipping_provider: "easypost", easypost_enabled: true }), true);
});

test("EasyPost production customer rates stay locked until founder enables them", () => {
  assert.equal(customerFacingEasyPostAllowed({ provider: "easypost", isTest: true, customerRatesEnabled: false }), true);
  assert.equal(customerFacingEasyPostAllowed({ provider: "easypost", isTest: false, customerRatesEnabled: false }), false);
  assert.equal(customerFacingEasyPostAllowed({ provider: "easypost", isTest: false, customerRatesEnabled: true }), true);
  assert.equal(customerFacingEasyPostAllowed({ provider: "shippo", isTest: false, customerRatesEnabled: true }), false);
});

test("EasyPost rate mapping keeps UPS and USPS only and drops invalid amounts", () => {
  const mapped = mapEasyPostRates({
    id: "shp_1",
    mode: "test",
    rates: [
      { id: "rate_ups", carrier: "UPS", service: "Ground", rate: "12.40", currency: "USD", delivery_days: 3 },
      { id: "rate_usps", carrier: "USPS", service: "Priority", rate: "8.10", currency: "USD", est_delivery_days: 2 },
      { id: "rate_fedex", carrier: "FedEx", service: "Ground", rate: "11.00", currency: "USD", delivery_days: 2 },
      { id: "rate_bad", carrier: "UPS", service: "Next", rate: "nope", currency: "USD" },
    ],
  });
  assert.equal(mapped.length, 2);
  assert.equal(mapped[0].provider, "ups");
  assert.equal(mapped[0].amount, 12.4);
  assert.equal(mapped[0].estimatedDays, 3);
  assert.equal(mapped[1].provider, "usps");
  assert.equal(mapped[1].service, "Priority");
  assert.equal(mapped.every((rate) => rate.test), true);
});
