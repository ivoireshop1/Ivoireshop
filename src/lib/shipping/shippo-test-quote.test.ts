import assert from "node:assert/strict";
import fs from "node:fs";
import { test } from "node:test";
import { destinationReadyForCarrierQuotes } from "../delivery/destination.ts";
import { parseShippingPackage } from "./packages.ts";
import {
  SHIPPO_TEST_QUOTE_CONFIRM,
  mergeSteelSixProducts,
  parseShippoTestQuoteDraft,
  prepareSteelSixShippoTestQuote,
  rememberShippoTestProbe,
  shippoTestProbeCooldownRemaining,
  shippoTestProbeRemainingForAdmin,
  shippoTestQuoteBlocker,
  shippoTestQuoteCredentialBlocker,
} from "./shippo-test-quote.ts";
import { STEEL_SIX_CART, STEEL_SIX_SHIPPO_DESTINATION } from "./steel-six-cart.ts";

const origin = {
  name: "Ivoire Shop",
  address_line_1: "1210 Rockbridge Rd NW",
  address_line_2: "Unit L",
  city: "Norcross",
  state: "GA",
  postal_code: "30093",
  country: "US",
  phone: "",
};

test("Shippo TEST quote stays closed until Admin confirmation", () => {
  const empty = parseShippoTestQuoteDraft(new FormData());
  assert.match(shippoTestQuoteBlocker(empty) ?? "", /does not buy postage/);
  const form = new FormData();
  form.set("acknowledge", "on");
  form.set("confirm", SHIPPO_TEST_QUOTE_CONFIRM);
  assert.equal(shippoTestQuoteBlocker(parseShippoTestQuoteDraft(form)), null);
  form.set("confirm", "wrong");
  assert.match(shippoTestQuoteBlocker(parseShippoTestQuoteDraft(form)) ?? "", /request-one-shippo-test-quote/);
});

test("Shippo TEST quote refuses live tokens and missing tokens", () => {
  assert.match(shippoTestQuoteCredentialBlocker({ configured: false, isTest: false, isLive: false }) ?? "", /not configured/);
  assert.match(shippoTestQuoteCredentialBlocker({ configured: true, isTest: false, isLive: true }) ?? "", /live Shippo token/);
  assert.match(shippoTestQuoteCredentialBlocker({ configured: true, isTest: false, isLive: false }) ?? "", /TEST token required/);
  assert.equal(shippoTestQuoteCredentialBlocker({ configured: true, isTest: true, isLive: false }), null);
});

test("Shippo TEST quote cooldown blocks accidental repeat requests", () => {
  rememberShippoTestProbe("admin-shippo-test", 1_000);
  assert.equal(shippoTestProbeCooldownRemaining(1_000, 1_000 + 30_000) > 0, true);
  assert.equal(shippoTestProbeRemainingForAdmin("admin-shippo-test", 0, 1_000 + 30_000) > 0, true);
  assert.equal(shippoTestProbeRemainingForAdmin("admin-shippo-test", 0, 1_000 + 121_000), 0);
});

test("six-product estimated parcels become a Shippo TEST payload for Clayton OH", () => {
  assert.equal(STEEL_SIX_CART.length, 6);
  assert.equal(destinationReadyForCarrierQuotes(STEEL_SIX_SHIPPO_DESTINATION), true);
  const prepared = prepareSteelSixShippoTestQuote({
    origin,
    products: mergeSteelSixProducts(),
    packages: [],
  });
  assert.equal(prepared.ok, true);
  if (!prepared.ok) return;
  assert.equal(prepared.destination.city, "Clayton");
  assert.equal(prepared.destination.postal_code, "45315");
  assert.ok(prepared.parcels.length >= 2);
  assert.equal(prepared.payload.length, prepared.parcels.length);
  assert.ok(prepared.payload.every((parcel) => Number(parcel.weight) > 0));
  assert.equal(JSON.stringify(prepared.payload).includes("amount"), false);
});

test("saved grocery box still packs the six-product cart without founder box entry", () => {
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
  const prepared = prepareSteelSixShippoTestQuote({
    origin,
    products: mergeSteelSixProducts(),
    packages: [grocery],
    defaultPackageId: grocery.id,
  });
  assert.equal(prepared.ok, true);
  if (!prepared.ok) return;
  assert.ok(prepared.parcels.length >= 1);
});

test("Preview-only Shippo probe stays closed and the Admin TEST action reuses quoteShippoShipment", () => {
  const probe = fs.readFileSync(new URL("../../../app/api/admin/shippo-quote-probe/route.ts", import.meta.url), "utf8");
  assert.match(probe, /VERCEL_ENV !== "preview"/);
  assert.match(probe, /Preview only/);
  const action = fs.readFileSync(new URL("../delivery/actions.ts", import.meta.url), "utf8");
  assert.match(action, /export async function requestShippoTestQuote/);
  assert.match(action, /quoteShippoShipment/);
  assert.doesNotMatch(action.slice(action.indexOf("export async function requestShippoTestQuote")), /shipping_provider:/);
  assert.doesNotMatch(action.slice(action.indexOf("export async function requestShippoTestQuote")), /postage_purchases_enabled:\s*true/);
});
