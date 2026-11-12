import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { isCheckoutEligibleShippingOption } from "./checkout-eligibility.ts";
import {
  clearUberTokenCache,
  formatUberAddress,
  getUberAccessToken,
  quoteUberDelivery,
  uberDirectEnvironment,
  uberDispatchAllowed,
  uberErrorMessage,
  verifyUberWebhookSignature,
} from "./providers/uber-direct.ts";
import { paidUberBookingBlocker, shouldApplyUberStatus, uberCustomerStage, uberIdempotencyKey } from "./uber-status.ts";
import { createHmac } from "node:crypto";

const sandboxEnv = {
  UBER_DIRECT_CUSTOMER_ID: "11111111-1111-1111-1111-111111111111",
  UBER_DIRECT_CLIENT_ID: "sandbox-client",
  UBER_DIRECT_CLIENT_SECRET: "sandbox-secret",
  UBER_DIRECT_ENVIRONMENT: "sandbox",
  UBER_DIRECT_WEBHOOK_SIGNING_KEY: "signing-key",
} as NodeJS.ProcessEnv;

const pickup = { street_address: ["1210 Rockbridge Rd NW"], city: "Norcross", state: "GA", zip_code: "30093", country: "US" };
const dropoff = { street_address: ["233 Peachtree St NE"], city: "Atlanta", state: "GA", zip_code: "30303", country: "US" };

test("OAuth uses one cached token until it expires", async () => {
  clearUberTokenCache();
  let authCalls = 0;
  const fetchImpl: typeof fetch = async (url) => {
    assert.match(String(url), /auth\.uber\.com\/oauth\/v2\/token/);
    authCalls += 1;
    return new Response(JSON.stringify({ access_token: "token-1", expires_in: 3600, token_type: "Bearer", scope: "eats.deliveries" }));
  };
  const now = Date.parse("2026-11-12T12:00:00Z");
  const first = await getUberAccessToken({ fetchImpl, now, env: sandboxEnv });
  const second = await getUberAccessToken({ fetchImpl, now: now + 1000, env: sandboxEnv });
  assert.equal(first, "token-1");
  assert.equal(second, "token-1");
  assert.equal(authCalls, 1);
  clearUberTokenCache();
});

test("a quote shows only the returned Uber fee and ETA", async () => {
  clearUberTokenCache();
  const fetchImpl: typeof fetch = async (url) => {
    if (String(url).includes("auth.uber.com")) return new Response(JSON.stringify({ access_token: "token-1", expires_in: 3600 }));
    return new Response(JSON.stringify({ id: "dqt_123", fee: 850, currency: "usd", expires: "2026-11-12T12:15:00Z", dropoff_eta: "2026-11-12T12:40:00Z", duration: 1800 }));
  };
  const quoted = await quoteUberDelivery({ pickup, dropoff, markupCents: 150, fetchImpl, now: Date.parse("2026-11-12T12:00:00Z"), env: sandboxEnv });
  assert.equal(quoted.option?.amount, 10);
  assert.equal(quoted.option?.uberFeeCents, 850);
  assert.equal(quoted.option?.uberMarkupCents, 150);
  assert.equal(quoted.option?.uberQuoteId, "dqt_123");
  assert.match(quoted.option?.estimate ?? "", /Estimated delivery/);
  clearUberTokenCache();
});

test("invalid addresses, expired quotes, unavailable couriers, and timeouts stay unbooked", () => {
  assert.equal(formatUberAddress({ address_line_1: "", city: "Atlanta", state: "GA", postal_code: "30303", country: "US" }), null);
  assert.match(uberErrorMessage(422, { code: "address_undeliverable" }, "fallback"), /address/);
  assert.match(uberErrorMessage(409, { code: "expired_quote" }, "fallback"), /expired/);
  assert.match(uberErrorMessage(422, { code: "no_couriers_available" }, "fallback"), /courier/);
  assert.match(uberErrorMessage(504, {}, "fallback"), /did not respond/);
});

test("an expired quote is not offered", async () => {
  clearUberTokenCache();
  const fetchImpl: typeof fetch = async (url) => {
    if (String(url).includes("auth.uber.com")) return new Response(JSON.stringify({ access_token: "token-1", expires_in: 3600 }));
    return new Response(JSON.stringify({ id: "dqt_old", fee: 500, expires: "2026-11-12T11:00:00Z" }));
  };
  const quoted = await quoteUberDelivery({ pickup, dropoff, fetchImpl, now: Date.parse("2026-11-12T12:00:00Z"), env: sandboxEnv });
  assert.equal(quoted.option, undefined);
  assert.match(quoted.unavailable ?? "", /expired/);
  clearUberTokenCache();
});

test("payment failure, fee mismatch, and disabled dispatch do not book a courier", () => {
  const base = { dispatchAllowed: true, quoteId: "dqt_123", quoteExpiresAt: "2026-11-12T12:15:00Z", now: Date.parse("2026-11-12T12:00:00Z"), feeCents: 850, markupCents: 0, shippingCost: 8.5 };
  assert.match(paidUberBookingBlocker({ ...base, paymentStatus: "failed", isDemo: false }) ?? "", /successful payment/);
  assert.match(paidUberBookingBlocker({ ...base, paymentStatus: "paid", isDemo: false, dispatchAllowed: false }) ?? "", /dispatch is off/);
  assert.match(paidUberBookingBlocker({ ...base, paymentStatus: "paid", isDemo: false, shippingCost: 4 }) ?? "", /no longer matches/);
  assert.equal(paidUberBookingBlocker({ ...base, paymentStatus: "paid", isDemo: false }), null);
  assert.equal(uberDispatchAllowed({ ...sandboxEnv, UBER_DIRECT_ENVIRONMENT: "production" }), false);
  assert.equal(uberDispatchAllowed({ ...sandboxEnv, UBER_DIRECT_ENVIRONMENT: "production", UBER_DIRECT_PRODUCTION_DISPATCH: "founder-approved" }), true);
  assert.equal(uberDirectEnvironment({}), "unidentified");
});

test("duplicate booking uses one idempotency key and stale webhook statuses do not move backward", () => {
  assert.equal(uberIdempotencyKey("order-1"), uberIdempotencyKey("order-1"));
  assert.equal(shouldApplyUberStatus("dropoff", "pickup"), false);
  assert.equal(shouldApplyUberStatus("pickup", "dropoff"), true);
  assert.equal(shouldApplyUberStatus("dropoff", "canceled"), true);
  assert.equal(uberCustomerStage({ status: "dropoff", courierName: "Ada" }), "en_route");
  assert.equal(uberCustomerStage({ status: "pickup", courierName: "Ada" }), "approaching");
});

test("webhook signatures accept the raw body and reject a changed body", () => {
  const body = '{"kind":"event.delivery_status","status":"dropoff"}';
  const signature = createHmac("sha256", "signing-key").update(body).digest("hex");
  assert.equal(verifyUberWebhookSignature(body, signature, "signing-key"), true);
  assert.equal(verifyUberWebhookSignature(`${body} `, signature, "signing-key"), false);
  assert.equal(verifyUberWebhookSignature(body, signature, ""), false);
});

test("pickup, UPS, and USPS checkout eligibility stays unchanged while Uber quotes are eligible", () => {
  assert.equal(isCheckoutEligibleShippingOption({ provider: "pickup", fulfillmentMethod: "local_pickup" }), true);
  assert.equal(isCheckoutEligibleShippingOption({ provider: "ups", fulfillmentMethod: "delivery", rateMode: "live_api" }), true);
  assert.equal(isCheckoutEligibleShippingOption({ provider: "usps", fulfillmentMethod: "delivery", rateMode: "store_rate" }), false);
  assert.equal(isCheckoutEligibleShippingOption({ provider: "uber", fulfillmentMethod: "delivery", rateMode: "live_api" }), true);
  const record = readFileSync(new URL("../payments/record.ts", import.meta.url), "utf8");
  const paid = record.slice(record.indexOf('if (input.status === "paid")'));
  assert.ok(paid.indexOf("bookPaidUberDelivery") > paid.indexOf('payment_status: "paid"'));
});
