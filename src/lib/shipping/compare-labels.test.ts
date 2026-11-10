import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  combineEasyshipBoxes,
  compareLabelsEligible,
  easyshipPurchaseReady,
  fullOrderComparison,
  isLowestKnown,
  mapEasyshipBoxQuote,
  missingPackageDetails,
  packageCsv,
  parseComparePackage,
  quoteFingerprint,
  quotesAreStale,
  COMPARE_PROVIDER_GRID,
  type CompareBox,
  type CompareShipFrom,
  type PostageQuote,
} from "./compare-labels.ts";

const origin: CompareShipFrom = {
  name: "Ivoire Shop",
  address_line_1: "1210 Rockbridge Rd NW",
  city: "Norcross",
  state: "GA",
  postal_code: "30093",
  country: "US",
};

const oneBox: CompareBox = { id: "box-1", weightLb: 2.5, lengthIn: 10, widthIn: 8, heightIn: 6 };
const twoBox: CompareBox = { id: "box-2", weightLb: 4, lengthIn: 12, widthIn: 10, heightIn: 8 };

function quote(boxId: string, carrier: "ups" | "usps", service: string, postage: number, days: number | null = 3): PostageQuote {
  return { boxId, carrier, service, postage, days, courierServiceId: `${carrier}-${service}` };
}

test("parcel orders can compare labels and pickup or local delivery cannot", () => {
  assert.equal(compareLabelsEligible({ fulfillment_method: "delivery", fulfillment_provider: "ups" }), true);
  assert.equal(compareLabelsEligible({ fulfillment_method: "delivery", fulfillment_provider: "usps" }), true);
  assert.equal(compareLabelsEligible({ fulfillment_method: "local_pickup", fulfillment_provider: "pickup" }), false);
  assert.equal(compareLabelsEligible({ fulfillment_method: "delivery", fulfillment_provider: "store" }), false);
  assert.equal(compareLabelsEligible({ fulfillment_method: "delivery", fulfillment_provider: "doordash" }), false);
  assert.equal(compareLabelsEligible({ fulfillment_method: "delivery", fulfillment_provider: null }), false);
});

test("a quote request with a missing dimension is rejected before any provider call", () => {
  const form = new FormData();
  form.set("ship_from_name", origin.name);
  form.set("ship_from_line1", origin.address_line_1);
  form.set("ship_from_city", origin.city);
  form.set("ship_from_state", origin.state);
  form.set("ship_from_postal", origin.postal_code);
  form.set("ship_from_country", origin.country);
  form.set("boxes_json", JSON.stringify([{ id: "box-1", weightLb: 2, lengthIn: 10, widthIn: "", heightIn: 6 }]));
  const parsed = parseComparePackage(form);
  assert.equal(parsed.ok, false);
  if (!parsed.ok) assert.match(parsed.error, /weight and dimensions/);
});

test("missing package details block a quote", () => {
  assert.match(missingPackageDetails([]) ?? "", /packed box/);
  assert.match(missingPackageDetails([{ ...oneBox, weightLb: 0 }]) ?? "", /weight and dimensions/);
  assert.equal(missingPackageDetails([oneBox]), null);
});

test("changing a packed box marks both quote sets stale", () => {
  const first = quoteFingerprint(origin, [oneBox]);
  const changed = quoteFingerprint(origin, [{ ...oneBox, weightLb: 3 }]);
  assert.equal(quotesAreStale(first, first), false);
  assert.equal(quotesAreStale(first, changed), true);
  assert.equal(quotesAreStale(null, first), true);
});

test("multi-box comparison waits until every box is priced and highlights the lowest total", () => {
  const partial = fullOrderComparison({
    boxIds: ["box-1", "box-2"],
    easyship: [{ boxId: "box-1", quotes: [quote("box-1", "ups", "Ground", 12)] }],
    pirate: [
      { boxId: "box-1", quotes: [quote("box-1", "ups", "Ground", 11)] },
      { boxId: "box-2", quotes: [quote("box-2", "ups", "Ground", 9)] },
    ],
  });
  assert.equal(partial[0].easyshipTotal, null);
  assert.equal(partial[0].pirateTotal, 20);
  assert.equal(isLowestKnown(partial[0].pirateTotal, partial[0].lowest), true);

  const complete = fullOrderComparison({
    boxIds: ["box-1", "box-2"],
    easyship: [
      { boxId: "box-1", quotes: [quote("box-1", "ups", "Ground", 12), quote("box-1", "usps", "Priority", 8)] },
      { boxId: "box-2", quotes: [quote("box-2", "ups", "Ground", 10), quote("box-2", "usps", "Priority", 7)] },
    ],
    pirate: [
      { boxId: "box-1", quotes: [quote("box-1", "ups", "Ground", 11)] },
      { boxId: "box-2", quotes: [quote("box-2", "ups", "Ground", 9)] },
    ],
  });
  const ground = complete.find((row) => row.key === "ups::ground");
  const priority = complete.find((row) => row.key === "usps::priority");
  assert.equal(ground?.easyshipTotal, 22);
  assert.equal(ground?.pirateTotal, 20);
  assert.equal(ground?.lowest, 20);
  assert.equal(priority?.pirateTotal, null);
  assert.equal(priority?.easyshipTotal, 15);
  assert.equal(priority?.lowest, 15);
});

test("an Easyship rejection leaves Pirate Ship totals usable", () => {
  const rejected = mapEasyshipBoxQuote("box-1", { ok: false });
  assert.equal(rejected.unavailable, true);
  assert.equal(combineEasyshipBoxes([rejected, mapEasyshipBoxQuote("box-2", { ok: false })]), "unavailable");
  const rows = fullOrderComparison({
    boxIds: ["box-1", "box-2"],
    easyship: "unavailable",
    pirate: [
      { boxId: "box-1", quotes: [quote("box-1", "usps", "Ground Advantage", 6, 2)] },
      { boxId: "box-2", quotes: [quote("box-2", "usps", "Ground Advantage", 7, 2)] },
    ],
  });
  assert.equal(rows[0].easyshipTotal, null);
  assert.equal(rows[0].pirateTotal, 13);
  assert.equal(rows[0].lowest, 13);
});

test("package CSV uses the confirmed boxes and does not carry secrets", () => {
  const csv = packageCsv([oneBox, twoBox], {
    name: "QA Quote",
    address_line_1: "233 Peachtree St NE",
    city: "Atlanta",
    state: "GA",
    postal_code: "30303",
    country: "US",
  });
  assert.equal(csv, [
    "box,weight_lb,length_in,width_in,height_in,ship_to_name,ship_to_line_1,ship_to_line_2,ship_to_city,ship_to_state,ship_to_postal,ship_to_country",
    "1,2.5,10,8,6,QA Quote,233 Peachtree St NE,,Atlanta,GA,30303,US",
    "2,4,12,10,8,QA Quote,233 Peachtree St NE,,Atlanta,GA,30303,US",
    "",
  ].join("\n"));
  assert.doesNotMatch(csv, /Bearer |sk_live_|rk_live_|prod_|sand_/);
});

test("Easyship purchase stays off unless the verified single-box UPS flow matches the saved service", () => {
  const selected = { carrier: "ups" as const, service: "Ground", postage: 12, courierServiceId: "ups_ground" };
  assert.equal(easyshipPurchaseReady({
    purchasesEnabled: false,
    verifiedUpsPurchase: true,
    selected,
    savedService: "Ground",
    savedCourierServiceId: "ups_ground",
    boxCount: 1,
  }), false);
  assert.equal(easyshipPurchaseReady({
    purchasesEnabled: true,
    verifiedUpsPurchase: true,
    selected,
    savedService: "Ground",
    savedCourierServiceId: "ups_ground",
    boxCount: 2,
  }), false);
  assert.equal(easyshipPurchaseReady({
    purchasesEnabled: true,
    verifiedUpsPurchase: true,
    selected: { ...selected, carrier: "usps" },
    savedService: "Ground",
    savedCourierServiceId: null,
    boxCount: 1,
  }), false);
  assert.equal(easyshipPurchaseReady({
    purchasesEnabled: true,
    verifiedUpsPurchase: true,
    selected,
    savedService: "Ground",
    savedCourierServiceId: "ups_ground",
    boxCount: 1,
  }), true);
});

test("compare wiring does not buy labels or change fulfillment while tracking stays on the customer order", () => {
  const action = readFileSync(new URL("./compare-label-actions.ts", import.meta.url), "utf8");
  const panel = readFileSync(new URL("../../components/admin/compare-buy-labels.tsx", import.meta.url), "utf8");
  const orderPage = readFileSync(new URL("../../../app/admin/orders/[id]/page.tsx", import.meta.url), "utf8");
  const customerPage = readFileSync(new URL("../../../app/account/orders/[id]/page.tsx", import.meta.url), "utf8");
  assert.doesNotMatch(action, /from\("orders"\)\.update|executeEasyshipLabelPurchase|shipping_cost|status:/);
  assert.match(action, /quoteEasyshipRates/);
  assert.match(panel, /Quote unavailable/);
  assert.match(panel, /Live quote/);
  assert.match(panel, /Entered by staff/);
  assert.match(panel, /Copy shipping address/);
  assert.match(panel, /Download package CSV/);
  assert.match(panel, /Open Pirate Ship/);
  assert.match(panel, /prefers-reduced-motion/);
  assert.match(panel, /grid grid-cols-1 gap-4 lg:grid-cols-2/);
  assert.equal(COMPARE_PROVIDER_GRID.includes("grid-cols-1"), true);
  assert.doesNotMatch(panel, /infinite|animate-spin|api\.ups\.com|api\.usps\.com/);
  assert.match(panel, /purchaseReady && selectedEasyship/);
  assert.match(orderPage, /showCompare \?/);
  assert.match(customerPage, /ShipmentTrackingPanel/);
  assert.match(customerPage, /tracking/);
});
