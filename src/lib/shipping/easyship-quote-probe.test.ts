import assert from "node:assert/strict";
import fs from "node:fs";
import { test } from "node:test";
import { carrierUnavailableCopy, shippingProviderLabel } from "./provider.ts";
import {
  EASYSHIP_PRODUCTION_QUOTE_CONFIRM,
  STEEL_SIX_EASYSHIP_DESTINATION,
  easyshipProbeCooldownRemaining,
  easyshipQuoteProbeBlocker,
  parseEasyshipQuoteProbeDraft,
  prepareSteelSixEasyshipQuote,
  rememberEasyshipProbe,
  easyshipProbeRemainingForAdmin,
  steelSixPriceGaps,
  steelSixSellingPrice,
} from "./easyship-quote-probe.ts";
import { easyshipApiMessage } from "./easyship.ts";
import { parseShippingPackage } from "./packages.ts";
import { mergeSteelSixProducts } from "./shippo-test-quote.ts";
import { STEEL_SIX_CART } from "./steel-six-cart.ts";

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

function pricedSteelSix(prices: number[]) {
  return mergeSteelSixProducts(STEEL_SIX_CART.map((item, index) => ({
    id: item.id,
    name: item.name,
    price: prices[index],
    item_weight_lb: item.item_weight_lb,
    weight_oz: item.weight_oz,
    packaging_weight_oz: item.packaging_weight_oz,
    weight_source: item.weight_source,
    category_slug: item.category_slug,
  })));
}

test("carrier unavailable copy names the selected provider instead of Shippo", () => {
  assert.match(carrierUnavailableCopy("ups", "easyship"), /Easyship did not return a UPS rate/);
  assert.doesNotMatch(carrierUnavailableCopy("ups", "easyship"), /Shippo|test rate/);
  assert.match(carrierUnavailableCopy("usps", "easypost"), /EasyPost did not return a USPS rate/);
  assert.match(carrierUnavailableCopy("ups", "shippo"), /Shippo did not return a UPS rate/);
  assert.equal(shippingProviderLabel("easyship"), "Easyship");
});

test("Easyship quote probe stays closed until the Admin confirmation button", () => {
  const empty = parseEasyshipQuoteProbeDraft(new FormData());
  assert.match(easyshipQuoteProbeBlocker(empty) ?? "", /Admin confirmation button/);
  const form = new FormData();
  form.set("confirm", EASYSHIP_PRODUCTION_QUOTE_CONFIRM);
  assert.equal(easyshipQuoteProbeBlocker(parseEasyshipQuoteProbeDraft(form)), null);
  form.set("confirm", "wrong");
  assert.match(easyshipQuoteProbeBlocker(parseEasyshipQuoteProbeDraft(form)) ?? "", /Admin confirmation button/);
  const parsed = parseEasyshipQuoteProbeDraft(form);
  assert.equal("parcel" in parsed, false);
  assert.equal("declaredValue" in parsed, false);
});

test("Easyship quote probe cooldown blocks accidental repeat requests", () => {
  rememberEasyshipProbe("admin-test", 1_000);
  assert.equal(easyshipProbeCooldownRemaining(1_000, 1_000 + 30_000) > 0, true);
  assert.equal(easyshipProbeRemainingForAdmin("admin-test", 0, 1_000 + 30_000) > 0, true);
  assert.equal(easyshipProbeRemainingForAdmin("admin-test", 0, 1_000 + 121_000), 0);
});

test("Easyship API messages are sanitized and never invent a charge", () => {
  assert.match(easyshipApiMessage({ error: { message: "missing public.rate:read Bearer prod_secretvalue" } }), /public\.rate:read/);
  assert.doesNotMatch(easyshipApiMessage({ error: { message: "Bearer prod_secretvalue denied" } }), /prod_secretvalue/);
  assert.match(easyshipApiMessage({
    error: {
      code: "invalid_content",
      message: "The request body content is not valid.",
      details: ["#/components/schemas/ParcelItemRateCreate missing required parameters: category"],
    },
  }), /category/);
});

test("six-product Easyship probe uses Clayton OH, Steel prices, and the automatic two-parcel estimate", () => {
  const prices = [18.99, 4.5, 12, 3.25, 7.1, 9.4];
  const products = pricedSteelSix(prices);
  assert.deepEqual(steelSixPriceGaps(products), []);
  const prepared = prepareSteelSixEasyshipQuote({
    origin,
    products,
    packages: [grocery],
    defaultPackageId: grocery.id,
  });
  assert.equal(prepared.ok, true);
  if (!prepared.ok) return;
  assert.equal(prepared.destination.city, "Clayton");
  assert.equal(prepared.destination.postal_code, "45315");
  assert.equal(STEEL_SIX_EASYSHIP_DESTINATION.address_line_1, "1 Main St");
  assert.equal(prepared.parcels.length, 2);
  assert.equal(prepared.parcelEstimate.length, 2);
  assert.equal(prepared.declaredValue, Number(prices.reduce((sum, price) => sum + price, 0).toFixed(2)));
  assert.equal(prepared.request.parcels.length, 2);
  assert.ok(prepared.request.parcels.every((parcel) => parcel.items.every((item) => item.category && Number(item.declared_customs_value) > 0)));
  assert.equal(prepared.request.calculate_tax_and_duties, false);
  assert.equal("buy_label" in prepared.request, false);
  assert.equal(JSON.stringify(prepared.request).includes("/shipments"), false);
  assert.equal("line_2" in prepared.request.destination_address, false);
});

test("missing Steel selling prices close the Easyship probe instead of inventing declared value", () => {
  assert.equal(steelSixSellingPrice(0), null);
  assert.equal(steelSixSellingPrice(null), null);
  const products = mergeSteelSixProducts();
  assert.ok(steelSixPriceGaps(products).length >= 1);
  const prepared = prepareSteelSixEasyshipQuote({
    origin,
    products,
    packages: [grocery],
    defaultPackageId: grocery.id,
  });
  assert.equal(prepared.ok, false);
  if (prepared.ok) return;
  assert.match(prepared.error, /never invented/);
});

test("Admin Easyship probe reuses the six-product RateRequest and never reads manual weight fields", () => {
  const action = fs.readFileSync(new URL("../delivery/actions.ts", import.meta.url), "utf8");
  const form = fs.readFileSync(new URL("../../components/admin/easyship-quote-probe-form.tsx", import.meta.url), "utf8");
  const start = action.indexOf("export async function requestEasyshipProductionQuote");
  const end = action.indexOf("export async function requestShippoTestQuote");
  const slice = action.slice(start, end);
  assert.match(slice, /prepareSteelSixEasyshipQuote/);
  assert.match(slice, /quoteEasyshipRates/);
  assert.match(slice, /STEEL_SIX_CART/);
  assert.doesNotMatch(slice, /formData\.get\("(weight_lb|declared_value|dest_line_1|length_in)"\)/);
  assert.doesNotMatch(slice, /buy_label:\s*true|postage_purchases_enabled:\s*true/);
  assert.doesNotMatch(form, /name="weight_lb"|name="declared_value"|name="dest_line_1"|name="length_in"/);
  assert.match(form, /Request one Easyship production quote/);
});
