import assert from "node:assert/strict";
import { test } from "node:test";
import {
  buildEasyshipRateRequest,
  classifyEasyshipHttpStatus,
  easyshipAddressReady,
  easyshipCredentials,
  easyshipKeysRotated,
  easyshipPublicStatus,
  easyshipQuoteErrorMessage,
  easyshipQuoteItems,
  identifyEasyshipProvider,
  mapEasyshipRates,
  quoteEasyshipRates,
  easyshipApiMessage,
} from "./easyship.ts";
import {
  carrierUnavailableCopy,
  customerFacingEasyShipAllowed,
  customerFacingShippoAllowed,
  liveCarrierApiEnabled,
  parseShippingProvider,
  shippingProviderLabel,
} from "./provider.ts";
import { optionToSnapshot } from "../delivery/snapshot.ts";
import { sanitizeProviderError } from "../delivery/types.ts";

test("shipping provider accepts Easyship without changing the Shippo default", () => {
  assert.equal(parseShippingProvider(undefined), "shippo");
  assert.equal(parseShippingProvider("easyship"), "easyship");
  assert.equal(parseShippingProvider("easypost"), "easypost");
  assert.equal(shippingProviderLabel("easyship"), "Easyship");
  assert.equal(liveCarrierApiEnabled({ shipping_provider: "easyship", easyship_enabled: false, shippo_enabled: true }), false);
  assert.equal(liveCarrierApiEnabled({ shipping_provider: "easyship", easyship_enabled: true }), true);
});

test("checkout unavailable copy uses Easyship when Easyship is selected", () => {
  assert.match(carrierUnavailableCopy("ups", "easyship"), /Easyship did not return a UPS rate/);
  assert.doesNotMatch(carrierUnavailableCopy("ups", "easyship"), /Shippo|test rate/);
  assert.match(easyshipApiMessage({ error: { message: "scope public.rate:read missing Bearer prod_secretvalue" } }), /public\.rate:read/);
  assert.doesNotMatch(easyshipApiMessage({ error: { message: "Bearer prod_secretvalue" } }), /prod_secretvalue/);
});

test("Easyship sandbox rates never become customer checkout prices", () => {
  assert.equal(customerFacingEasyShipAllowed({ provider: "easyship", isSandbox: true, isProduction: false, customerRatesEnabled: true }), false);
  assert.equal(customerFacingEasyShipAllowed({ provider: "easyship", isSandbox: false, isProduction: true, customerRatesEnabled: false }), false);
  assert.equal(customerFacingEasyShipAllowed({ provider: "easyship", isSandbox: false, isProduction: true, customerRatesEnabled: true }), true);
  assert.equal(customerFacingEasyShipAllowed({ provider: "shippo", isSandbox: false, isProduction: true, customerRatesEnabled: true }), false);
});

test("Shippo TEST rates never become customer checkout prices", () => {
  assert.equal(customerFacingShippoAllowed({ provider: "shippo", isTest: true, isLive: false, customerRatesEnabled: true }), false);
  assert.equal(customerFacingShippoAllowed({ provider: "shippo", isTest: false, isLive: false, customerRatesEnabled: true }), false);
  assert.equal(customerFacingShippoAllowed({ provider: "shippo", isTest: false, isLive: true, customerRatesEnabled: false }), false);
  assert.equal(customerFacingShippoAllowed({ provider: "shippo", isTest: false, isLive: true, customerRatesEnabled: true }), true);
  assert.equal(customerFacingShippoAllowed({ provider: "easyship", isTest: false, isLive: true, customerRatesEnabled: true }), false);
});

test("Easyship credentials classify sand_ and prod_ prefixes without exposing the key", () => {
  const previous = process.env.EASYSHIP_API_KEY;
  process.env.EASYSHIP_API_KEY = "sand_local_test_placeholder";
  const sandbox = easyshipCredentials();
  assert.equal(sandbox.configured, true);
  assert.equal(sandbox.isSandbox, true);
  assert.equal(sandbox.host, "https://public-api-sandbox.easyship.com");
  process.env.EASYSHIP_API_KEY = "prod_local_test_placeholder";
  const production = easyshipCredentials();
  assert.equal(production.isProduction, true);
  assert.equal(production.host, "https://public-api.easyship.com");
  process.env.EASYSHIP_API_KEY = "other_local_test_placeholder";
  assert.equal(easyshipCredentials().mode, "unknown");
  if (previous == null) delete process.env.EASYSHIP_API_KEY;
  else process.env.EASYSHIP_API_KEY = previous;
});

test("Easyship rate mapping keeps UPS and USPS USD totals and drops other carriers", () => {
  const mapped = mapEasyshipRates({
    rates: [
      { courier_service: { id: "ups-1", name: "UPS Ground", umbrella_name: "UPS" }, total_charge: 12.4, currency: "USD", min_delivery_time: 3 },
      { courier_service: { id: "usps-1", name: "USPS Priority Mail", umbrella_name: "USPS" }, total_charge: 8.1, currency: "USD", max_delivery_time: 2 },
      { courier_service: { id: "fedex-1", name: "FedEx Ground", umbrella_name: "FedEx" }, total_charge: 11, currency: "USD" },
      { courier_service: { id: "ups-hkd", name: "UPS Saver", umbrella_name: "UPS" }, total_charge: 90, currency: "HKD" },
      { courier_service: { id: "ups-bad", name: "UPS Next", umbrella_name: "UPS" }, total_charge: "nope", currency: "USD" },
    ],
  }, [], true);
  assert.equal(mapped.length, 2);
  assert.equal(mapped[0].provider, "ups");
  assert.equal(mapped[0].amount, 12.4);
  assert.equal(mapped[0].estimatedDays, 3);
  assert.equal(mapped[1].provider, "usps");
  assert.equal(mapped[1].service, "USPS Priority Mail");
  assert.equal(mapped.every((rate) => rate.test), true);
  assert.equal(identifyEasyshipProvider("United Parcel Service"), null);
});

test("Easyship rate request is quote-only and uses actual lb/in parcel data", () => {
  const items = easyshipQuoteItems([
    { quantity: 2, price: 5.19, description: "Fufu" },
    { quantity: 1, price: 0 },
  ]);
  assert.equal(items.length, 1);
  assert.equal(items[0].declared_customs_value, 5.19);
  const request = buildEasyshipRateRequest({
    origin: { name: "Ivoire Shop", address_line_1: "1 Main", city: "Norcross", state: "GA", postal_code: "30093", country: "US" },
    destination: { address_line_1: "2 Oak", city: "Atlanta", state: "GA", postal_code: "30308", country: "US" },
    parcel: { weightLb: 2.5, lengthIn: 10, widthIn: 8, heightIn: 6 },
    items,
  });
  assert.equal("buy_label" in request, false);
  assert.equal(JSON.stringify(request).includes("/shipments"), false);
  assert.equal(request.shipping_settings.units.weight, "lb");
  assert.equal(request.shipping_settings.units.dimensions, "in");
  assert.equal(request.parcels[0].total_actual_weight, 2.5);
  assert.deepEqual(request.parcels[0].box, { length: 10, width: 8, height: 6 });
  const multi = buildEasyshipRateRequest({
    origin: { name: "Ivoire Shop", address_line_1: "1 Main", city: "Norcross", state: "GA", postal_code: "30093", country: "US" },
    destination: { address_line_1: "1 Main St", city: "Clayton", state: "OH", postal_code: "45315", country: "US" },
    parcels: [
      { weightLb: 6, lengthIn: 10, widthIn: 8, heightIn: 6 },
      { weightLb: 4, lengthIn: 10, widthIn: 8, heightIn: 6 },
    ],
    items,
  });
  assert.equal(multi.parcels.length, 2);
  assert.equal(multi.parcels[0].box.height, 6);
  assert.equal(multi.parcels[1].box.height, 6);
});

test("Easyship address and HTTP errors stay explicit", () => {
  assert.equal(easyshipAddressReady(
    { city: "Norcross", state: "GA", postal_code: "30093", country: "US" },
    { address_line_1: "2 Oak", city: "Atlanta", postal_code: "30308", country: "US" },
  ), false);
  assert.equal(classifyEasyshipHttpStatus(403, { error: { message: "missing public.rate:read" } }), "missing_scope");
  assert.equal(classifyEasyshipHttpStatus(401, {}), "unauthorized");
  assert.equal(classifyEasyshipHttpStatus(429, {}), "rate_limited");
  assert.match(easyshipQuoteErrorMessage("missing_scope"), /public\.rate:read/);
  assert.match(easyshipQuoteErrorMessage("invalid_parcel"), /never invented/);
});

test("Easyship quote does not call the network when parcel or prices are missing", async () => {
  const previous = process.env.EASYSHIP_API_KEY;
  process.env.EASYSHIP_API_KEY = "sand_local_test_placeholder";
  const missingParcel = await quoteEasyshipRates({
    origin: { city: "Norcross", state: "GA", postal_code: "30093", country: "US" },
    destination: { address_line_1: "2 Oak", city: "Atlanta", state: "GA", postal_code: "30308", country: "US" },
    parcel: { weightLb: 0, lengthIn: 10, widthIn: 8, heightIn: 6 },
    products: [{ quantity: 1, price: 5 }],
  });
  assert.equal(missingParcel.ok, false);
  if (!missingParcel.ok) assert.equal(missingParcel.code, "invalid_parcel");
  const missingPrice = await quoteEasyshipRates({
    origin: { city: "Norcross", state: "GA", postal_code: "30093", country: "US" },
    destination: { address_line_1: "2 Oak", city: "Atlanta", state: "GA", postal_code: "30308", country: "US" },
    parcel: { weightLb: 2, lengthIn: 10, widthIn: 8, heightIn: 6 },
    products: [{ quantity: 1, price: null }],
  });
  assert.equal(missingPrice.ok, false);
  if (!missingPrice.ok) assert.equal(missingPrice.code, "missing_declared_value");
  if (previous == null) delete process.env.EASYSHIP_API_KEY;
  else process.env.EASYSHIP_API_KEY = previous;
});

test("Easyship snapshots and error sanitizer never leak the API key", () => {
  const snapshot = optionToSnapshot({
    id: "ups:live:ground:3d",
    provider: "ups",
    fulfillmentMethod: "delivery",
    label: "UPS · Ground",
    amount: 12.4,
    quoteSource: "easyship",
    easyshipRateId: "ups-1",
    testRate: true,
    etaDays: 3,
  });
  assert.equal(snapshot.quote_source, "easyship");
  assert.equal(snapshot.easyship_rate_id, "ups-1");
  assert.equal(snapshot.currency, "USD");
  const publicStatus = easyshipPublicStatus();
  assert.equal("key" in publicStatus, false);
  assert.equal(easyshipKeysRotated({}), false);
  assert.equal(easyshipKeysRotated({ EASYSHIP_KEYS_ROTATED: "true" }), true);
  assert.doesNotMatch(sanitizeProviderError("Bearer sand_local_test_placeholder failed"), /sand_/);
  assert.doesNotMatch(sanitizeProviderError("prod_local_test_placeholder"), /prod_local/);
});
