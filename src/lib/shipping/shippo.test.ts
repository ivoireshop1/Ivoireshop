import assert from "node:assert/strict";
import { test } from "node:test";
import {
  applyShippingMargin,
  assignUniqueLiveOptionIds,
  canPrepareShippoLabel,
  identifyShippoProvider,
  internationalDestinationAllowed,
  liveIdentityFromOptionId,
  liveOptionId,
  mapShippoRates,
  parseAllowedServices,
  parseCountryList,
  ratesMatchSelection,
  shippoServiceLabel,
} from "./shippo.ts";

test("Shippo test rates map UPS and USPS only and apply founder margin", () => {
  const rates = mapShippoRates({
    rates: [
      { object_id: "r1", provider: "UPS", servicelevel_name: "Ground", amount: "12.40", currency: "USD", estimated_days: 3, test: true },
      { object_id: "r2", provider: "USPS", servicelevel_name: "Priority Mail", amount: "9.10", currency: "USD", duration_terms: "1-3 days", test: true },
      { object_id: "r3", provider: "FedEx", servicelevel_name: "Home", amount: "18.00", currency: "USD", test: true },
    ],
  });
  assert.equal(rates.length, 2);
  assert.equal(rates[0].provider, "ups");
  assert.equal(rates[1].provider, "usps");
  assert.equal(applyShippingMargin(12.4, 10), 13.64);
  assert.equal(canPrepareShippoLabel({ isTest: true, postagePurchasesEnabled: false }), true);
  assert.equal(canPrepareShippoLabel({ isTest: false, postagePurchasesEnabled: false }), false);
  assert.equal(canPrepareShippoLabel({ isTest: true, postagePurchasesEnabled: true }), false);
});

test("international allowlist and service filters stay explicit", () => {
  assert.deepEqual(parseCountryList("CA, GB"), ["CA", "GB"]);
  assert.equal(internationalDestinationAllowed("CA", ["CA", "GB"]), true);
  assert.equal(internationalDestinationAllowed("FR", ["CA", "GB"]), false);
  assert.equal(internationalDestinationAllowed("US", ["CA"]), true);
  const filtered = mapShippoRates({
    rates: [
      { object_id: "r1", provider: "ups", servicelevel_name: "Ground", servicelevel_token: "ups_ground", amount: "8.00" },
      { object_id: "r2", provider: "ups", servicelevel_name: "Next Day Air", servicelevel_token: "ups_next_day_air", amount: "28.00" },
    ],
  }, parseAllowedServices("Ground"));
  assert.equal(filtered.length, 1);
  assert.equal(filtered[0].service, "Ground");
});

test("checkout revalidation refuses a silent substitute when the live quote changed", () => {
  const fresh = [{ id: "ups:r1", provider: "ups", serviceCode: "Ground", amount: 13.64, shippoRateId: "r1" }];
  assert.equal(ratesMatchSelection({ id: "ups:r1", provider: "ups", serviceCode: "Ground", amount: 13.64, shippoRateId: "r1" }, fresh), true);
  assert.equal(ratesMatchSelection({ id: "ups:r1", provider: "ups", serviceCode: "Ground", amount: 9.00, shippoRateId: "r1" }, fresh), false);
  assert.equal(ratesMatchSelection({ id: "ups:manual:domestic", provider: "ups", serviceCode: "manual-domestic", amount: 12 }, fresh), false);
  assert.equal(liveOptionId("ups", "Ground"), "ups:live:ground:x");
  assert.equal(liveOptionId("ups", "Shipping", { token: "ups_ground", days: 3 }), "ups:live:ups-ground:3d");
});

test("generic Shippo service names stay unique across UPS and USPS transits", () => {
  assert.equal(shippoServiceLabel("Shipping", "ups_ground"), "Ground");
  assert.equal(shippoServiceLabel("Priority Mail", "usps_priority"), "Priority Mail");
  const rates = mapShippoRates({
    rates: [
      { object_id: "u1", provider: "UPS", servicelevel_name: "Shipping", servicelevel_token: "ups_ground", amount: "11.96", estimated_days: 2, test: true },
      { object_id: "u2", provider: "UPS", servicelevel_name: "Shipping", servicelevel_token: "ups_3_day_select", amount: "11.91", estimated_days: 3, test: true },
      { object_id: "p1", provider: "USPS", servicelevel_name: "Shipping", servicelevel_token: "usps_priority", amount: "7.09", estimated_days: 4, test: true },
      { object_id: "p2", provider: "USPS", servicelevel_name: "Shipping", servicelevel_token: "usps_priority", amount: "54.41", estimated_days: 2, test: true },
    ],
  });
  assert.equal(rates[0].service, "Ground");
  assert.equal(rates[1].service, "3 Day Select");
  assert.equal(rates[2].service, "Priority");
  const ids = rates.map((rate) => liveOptionId(rate.provider, rate.service, { token: rate.serviceToken, days: rate.estimatedDays }));
  assert.equal(new Set(ids).size, 4);
  assert.equal(ids[0], "ups:live:ups-ground:2d");
  assert.equal(ids[2], "usps:live:usps-priority:4d");
  const collided = assignUniqueLiveOptionIds([
    { id: "ups:live:shipping:2d", shippoRateId: "aaa" },
    { id: "ups:live:shipping:2d", shippoRateId: "bbb" },
  ]);
  assert.equal(collided[0].id, "ups:live:shipping:2d");
  assert.equal(collided[1].id, "ups:live:shipping:2d:bbb");
  assert.equal(liveIdentityFromOptionId(collided[1].id), "ups:live:shipping:2d");
});

test("Shippo provider identification never maps USPS onto UPS", () => {
  assert.equal(identifyShippoProvider("USPS"), "usps");
  assert.equal(identifyShippoProvider("usps"), "usps");
  assert.equal(identifyShippoProvider("UPS"), "ups");
  assert.equal(identifyShippoProvider("ups"), "ups");
  // Regression: String.includes("ups") is true for "usps" — must check USPS first.
  assert.equal(identifyShippoProvider("usps_priority"), "usps");
  assert.equal(identifyShippoProvider("078870331023437cb917f5187429b093"), null);
});

test("nested Shippo servicelevel objects supply real service names and tokens", () => {
  const rates = mapShippoRates({
    rates: [
      {
        object_id: "n1",
        provider: "USPS",
        amount: "7.10",
        currency: "USD",
        estimated_days: 5,
        test: true,
        servicelevel: { name: "Priority Mail", token: "usps_priority" },
      },
      {
        object_id: "n2",
        provider: "UPS",
        amount: "12.00",
        currency: "USD",
        estimated_days: 3,
        test: true,
        servicelevel: { name: "Ground", token: "ups_ground" },
      },
      {
        object_id: "n3",
        provider: "USPS",
        amount: "58.14",
        currency: "USD",
        estimated_days: 2,
        test: true,
        servicelevel: { name: "Shipping", token: "usps_priority_express" },
      },
    ],
  });
  assert.equal(rates.map((rate) => rate.service).join("|"), "Priority Mail|Ground|Priority Express");
  assert.equal(rates[0].serviceToken, "usps_priority");
  assert.equal(rates[2].serviceToken, "usps_priority_express");
});
