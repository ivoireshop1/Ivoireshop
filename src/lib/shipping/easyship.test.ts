import assert from "node:assert/strict";
import { test } from "node:test";
import {
  buildEasyshipRateRequest,
  classifyEasyshipHttpStatus,
  easyshipAddressReady,
  easyshipCredentials,
  easyshipItemCategory,
  easyshipKeysRotated,
  easyshipPublicStatus,
  easyshipQuoteErrorMessage,
  easyshipQuoteItems,
  easyshipRateRequestIssues,
  identifyEasyshipProvider,
  mapEasyshipRates,
  quoteEasyshipRates,
  easyshipApiMessage,
  easyshipCustomerError,
} from "./easyship.ts";
import { parseShippingPackage, resolveCartParcel } from "./packages.ts";
import { STEEL_SIX_CART, STEEL_SIX_SHIPPO_DESTINATION } from "./steel-six-cart.ts";
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
    { quantity: 2, price: 5.19, description: "Fufu", category_slug: "foods" },
    { quantity: 1, price: 0 },
  ]);
  assert.equal(items.length, 1);
  assert.equal(items[0].declared_customs_value, 5.19);
  assert.equal(items[0].category, "dry_food_supplements");
  assert.equal(easyshipItemCategory({ category_slug: "cosmetics" }), "health_beauty");
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
  assert.equal("line_2" in request.origin_address, false);
  assert.equal("contact_phone" in request.origin_address, false);
  assert.equal("line_2" in request.destination_address, false);
  assert.equal(request.origin_address.contact_name, "Ivoire Shop");
  assert.equal(easyshipRateRequestIssues(request).length, 0);
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
  assert.equal(easyshipRateRequestIssues(multi).length, 0);
});

test("six-product two-parcel Easyship payload matches the official RateRequest schema", () => {
  const grocery = parseShippingPackage({
    id: "af66826c-c9ad-464d-a001-a0f79387f949",
    name: "standard grocery box",
    length_in: 16,
    width_in: 12,
    height_in: 8,
    max_weight_lb: 30,
    tare_weight_lb: 0.39,
    is_active: true,
  })!;
  const packed = resolveCartParcel({
    products: STEEL_SIX_CART.map((product) => ({ ...product, price: 8.11 })),
    packages: [grocery],
    defaultPackageId: grocery.id,
  });
  assert.equal(packed.parcels.length, 2);
  const items = easyshipQuoteItems(STEEL_SIX_CART.map((product) => ({ ...product, price: 8.11, description: product.name })));
  const request = buildEasyshipRateRequest({
    origin: { name: "Ivoire Shop", address_line_1: "1210 Rockbridge Rd NW", address_line_2: "Unit L", city: "Norcross", state: "GA", postal_code: "30093", country: "US", phone: "4705550100" },
    destination: { ...STEEL_SIX_SHIPPO_DESTINATION, name: "Clayton recipient", phone: "9375550100" },
    parcels: packed.parcels.map((parcel) => ({
      weightLb: parcel.weightLb,
      lengthIn: parcel.lengthIn,
      widthIn: parcel.widthIn,
      heightIn: parcel.heightIn,
      items: easyshipQuoteItems(parcel.items),
    })),
    items,
  });
  assert.equal(request.parcels.length, 2);
  assert.equal(request.parcels[0].total_actual_weight, 29.49);
  assert.equal(request.parcels[1].total_actual_weight, 6.165);
  assert.ok(request.parcels.every((parcel) => parcel.items.length >= 1 && parcel.items.every((item) => item.category)));
  assert.equal(request.origin_address.line_2, "Unit L");
  assert.equal(request.origin_address.contact_phone, "4705550100");
  assert.equal(request.destination_address.contact_name, "Clayton recipient");
  assert.equal(request.calculate_tax_and_duties, false);
  assert.equal("buy_label" in request, false);
  assert.equal(JSON.stringify(request).includes("amount"), false);
  assert.deepEqual(easyshipRateRequestIssues(request), []);
});

test("empty optional Easyship strings and missing item categories fail local schema checks", () => {
  const issues = easyshipRateRequestIssues({
    origin_address: { city: "Norcross", state: "GA", postal_code: "30093", country_alpha2: "US", contact_phone: "" },
    destination_address: { line_1: "1 Main St", city: "Clayton", state: "OH", postal_code: "45315", country_alpha2: "US" },
    shipping_settings: { units: { weight: "lb", dimensions: "in" }, output_currency: "USD" },
    calculate_tax_and_duties: false,
    parcels: [{
      total_actual_weight: 2,
      box: { length: 10, width: 8, height: 6 },
      items: [{ description: "Fufu", quantity: 1, declared_currency: "USD", declared_customs_value: 5.19 }],
    }],
  });
  assert.ok(issues.some((issue) => /category or hs_code/.test(issue)));
  assert.ok(issues.some((issue) => /empty optional strings/.test(issue)));
});

test("Easyship address and HTTP errors stay explicit", () => {
  assert.equal(easyshipAddressReady(
    { city: "Norcross", state: "GA", postal_code: "30093", country: "US" },
    { address_line_1: "2 Oak", city: "Atlanta", postal_code: "30308", country: "US" },
  ), false);
  assert.equal(classifyEasyshipHttpStatus(403, { error: { message: "missing public.rate:read" } }), "missing_scope");
  assert.equal(classifyEasyshipHttpStatus(401, {}), "unauthorized");
  assert.equal(classifyEasyshipHttpStatus(422, { error: { code: "invalid_content", message: "The request body content is not valid." } }), "invalid_content");
  assert.match(easyshipCustomerError({
    error: easyshipQuoteErrorMessage("invalid_content"),
    apiMessage: easyshipApiMessage({
      error: {
        code: "invalid_content",
        message: "The request body content is not valid.",
        details: [
          "#/components/schemas/ParcelItemRateCreate missing required parameters: category",
          "origin_address.contact_phone is invalid Bearer prod_secretvalue",
        ],
      },
    }),
  }), /category/);
  assert.match(easyshipCustomerError({
    error: easyshipQuoteErrorMessage("invalid_content"),
    apiMessage: "origin_address.contact_phone is invalid",
  }), /contact_phone/);
  assert.doesNotMatch(easyshipCustomerError({
    error: easyshipQuoteErrorMessage("invalid_content"),
    apiMessage: "Bearer prod_secretvalue",
  }), /prod_secretvalue/);
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
    currency: "USD",
    parcelEstimate: {
      counted: 2,
      totalWeightLb: 35.655,
      estimatedBox: true,
      parcels: [{
        boxId: "estimate-large-box",
        boxName: "Estimated large box",
        estimatedBox: true,
        weightLb: 29.49,
        lengthIn: 16,
        widthIn: 12,
        heightIn: 8,
        unknownItemDimensions: true,
        items: ["ELEPHANT BRAND Broken Jasmine Rice A1 Super"],
      }],
    },
  });
  assert.equal(snapshot.quote_source, "easyship");
  assert.equal(snapshot.easyship_rate_id, "ups-1");
  assert.equal(snapshot.currency, "USD");
  assert.equal(snapshot.parcel_estimate?.counted, 2);
  assert.equal(snapshot.parcel_estimate?.totalWeightLb, 35.655);
  assert.equal(JSON.stringify(snapshot.parcel_estimate).includes("amount"), false);
  const publicStatus = easyshipPublicStatus();
  assert.equal("key" in publicStatus, false);
  assert.equal(easyshipKeysRotated({}), false);
  assert.equal(easyshipKeysRotated({ EASYSHIP_KEYS_ROTATED: "true" }), true);
  assert.doesNotMatch(sanitizeProviderError("Bearer sand_local_test_placeholder failed"), /sand_/);
  assert.doesNotMatch(sanitizeProviderError("prod_local_test_placeholder"), /prod_local/);
});
