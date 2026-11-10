import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { buildEasyshipShipmentBody, executeEasyshipLabelPurchase, parseEasyshipLabelResponse } from "./easyship-label-api.ts";
import {
  EASYSHIP_UPS_LABEL_CONFIRM,
  decideEasyshipLabelPurchase,
  easyshipChargeCoversCarrierFees,
  easyshipLabelPurchasesEnabled,
  labelCostComparison,
  beginLabelPurchase,
  labelPdfReady,
  purchaseRequestGate,
  runLabelPurchase,
  trackingNotificationAfterSave,
  type UpsLabelOrder,
  type UpsLabelRate,
} from "./easyship-labels.ts";
import { buildEasyshipRateRequest } from "./easyship.ts";

const order: UpsLabelOrder = {
  id: "order-1",
  paymentStatus: "paid",
  isDemo: false,
  status: "processing",
  fulfillmentMethod: "delivery",
  provider: "ups",
  service: "UPS Ground",
  shippingCost: 18.4,
  courierServiceId: "ups-ground",
};

const rate: UpsLabelRate = {
  courierServiceId: "ups-ground",
  provider: "ups",
  service: "UPS Ground",
  amount: 21.15,
  currency: "USD",
  estimatedDays: 3,
  shipmentCharge: 16.4,
  fuelSurcharge: 3.1,
};

function decision(overrides: Partial<Parameters<typeof decideEasyshipLabelPurchase>[0]> = {}) {
  return decideEasyshipLabelPurchase({
    order,
    rates: [rate, { ...rate, courierServiceId: "usps-1", provider: "usps", service: "USPS Ground", amount: 9 }],
    reviewedAmount: 21.15,
    reviewedServiceId: "ups-ground",
    confirm: EASYSHIP_UPS_LABEL_CONFIRM,
    purchasesEnabled: true,
    existing: null,
    ...overrides,
  });
}

test("UPS label purchases stay off unless the founder flag is exact", () => {
  const previous = process.env.EASYSHIP_LABEL_PURCHASES;
  delete process.env.EASYSHIP_LABEL_PURCHASES;
  assert.equal(easyshipLabelPurchasesEnabled(), false);
  process.env.EASYSHIP_LABEL_PURCHASES = "true";
  assert.equal(easyshipLabelPurchasesEnabled(), false);
  process.env.EASYSHIP_LABEL_PURCHASES = "founder-approved";
  assert.equal(easyshipLabelPurchasesEnabled(), true);
  if (previous == null) delete process.env.EASYSHIP_LABEL_PURCHASES;
  else process.env.EASYSHIP_LABEL_PURCHASES = previous;
});

test("label review shows the customer charge, label cost, and difference without buying", async () => {
  const shown = decision({ confirm: "", purchasesEnabled: false });
  assert.equal(shown.action, "show");
  if (shown.action !== "show") return;
  assert.deepEqual(labelCostComparison(18.4, 21.15), shown.comparison);
  assert.equal(shown.comparison.difference, 2.75);
  const ran = await runLabelPurchase(shown, async () => {
    throw new Error("postage was requested");
  });
  assert.equal(ran.called, false);
});

test("a confirmed purchase is refused while the founder flag is off", async () => {
  const blocked = decision({ purchasesEnabled: false });
  assert.equal(blocked.action, "blocked");
  const ran = await runLabelPurchase(blocked, async () => "charged");
  assert.equal(ran.called, false);
});

test("expired and changed UPS quotes are not purchased", async () => {
  const changed = decision({ reviewedAmount: 19 });
  assert.equal(changed.action, "quote_changed");
  const swapped = decision({ reviewedServiceId: "ups-other" });
  assert.equal(swapped.action, "quote_changed");
  assert.equal((await runLabelPurchase(changed, async () => "charged")).called, false);
});

test("unpaid, pickup, USPS, cancelled, and demo orders cannot buy a UPS label", () => {
  assert.equal(decision({ order: { ...order, paymentStatus: "pending" } }).action, "ineligible");
  assert.equal(decision({ order: { ...order, fulfillmentMethod: "local_pickup", provider: "pickup" } }).action, "ineligible");
  assert.equal(decision({ order: { ...order, provider: "usps", service: "USPS Ground", courierServiceId: "usps-1" } }).action, "ineligible");
  assert.equal(decision({ order: { ...order, status: "cancelled" } }).action, "ineligible");
  assert.equal(decision({ order: { ...order, isDemo: true } }).action, "ineligible");
});

test("duplicate clicks and failed attempts do not create another purchase", async () => {
  const purchased = decision({
    existing: { id: "row", status: "purchased", idempotencyKey: "key", courierServiceId: "ups-ground", labelCost: 21.15, easyshipShipmentId: "shp", trackingNumber: "1Z999AA10123456784", errorMessage: null },
  });
  assert.equal(purchased.action, "duplicate");
  const held = decision({
    existing: { id: "row", status: "failed", idempotencyKey: "key", courierServiceId: "ups-ground", labelCost: 21.15, easyshipShipmentId: null, trackingNumber: null, errorMessage: "Easyship did not create the UPS shipment." },
  });
  assert.equal(held.action, "hold");
  const retried = decision({
    retryMode: "new",
    failedAttempts: 1,
    existing: { id: "row", status: "failed", idempotencyKey: "key", courierServiceId: "ups-ground", labelCost: 21.15, easyshipShipmentId: null, trackingNumber: null, errorMessage: "failed" },
  });
  assert.equal(retried.action, "buy");
  if (retried.action === "buy") assert.match(retried.idempotencyKey, /:a2$/);
  const resumed = decision({
    existing: { id: "row", status: "purchasing", idempotencyKey: "same-key", courierServiceId: "ups-ground", labelCost: 21.15, easyshipShipmentId: "shp-1", trackingNumber: null, errorMessage: null },
  });
  assert.equal(resumed.action, "resume");
  if (resumed.action === "resume") {
    assert.equal(resumed.idempotencyKey, "same-key");
    assert.equal(resumed.existingShipmentId, "shp-1");
  }
  assert.equal((await runLabelPurchase(purchased, async () => "charged")).called, false);
  assert.equal((await runLabelPurchase(held, async () => "charged")).called, false);
});

test("a quote whose total is below the listed courier charge and fuel is refused", () => {
  const broken = { ...rate, amount: 10, shipmentCharge: 16.4, fuelSurcharge: 3.1 };
  assert.equal(easyshipChargeCoversCarrierFees(broken).coversKnownParts, false);
  assert.equal(decision({ rates: [broken] }).action, "ineligible");
  assert.equal(easyshipChargeCoversCarrierFees(rate).coversKnownParts, true);
});

test("tracking notification is recorded only after the tracking number is saved", () => {
  assert.equal(trackingNotificationAfterSave({ persisted: false, trackingNumber: "1Z999AA10123456784" }), null);
  assert.equal(trackingNotificationAfterSave({ persisted: true, trackingNumber: null }), null);
  assert.equal(trackingNotificationAfterSave({ persisted: true, trackingNumber: "1Z999AA10123456784" }), "tracking_added");
});

test("Easyship label purchase uses the reviewed UPS service and never buys during shipment creation", async () => {
  const request = buildEasyshipRateRequest({
    origin: { name: "Ivoire Shop", address_line_1: "1210 Rockbridge Rd NW", city: "Norcross", state: "GA", postal_code: "30093", country: "US", phone: "4045550100" },
    destination: { name: "A Customer", address_line_1: "1 Main St", city: "Clayton", state: "OH", postal_code: "45315", country: "US" },
    parcel: { weightLb: 2, lengthIn: 10, widthIn: 8, heightIn: 6 },
    items: [{ description: "Rice", category: "dry_food_supplements", quantity: 1, declared_currency: "USD", declared_customs_value: 12 }],
  });
  const body = buildEasyshipShipmentBody({ rateRequest: request, courierServiceId: "ups-ground", destinationEmail: "buyer@example.com" });
  assert.equal(body.shipping_settings.buy_label, false);
  assert.equal(body.shipping_settings.buy_label_synchronous, false);
  assert.equal(body.courier_settings.allow_fallback, false);
  assert.equal(body.courier_settings.courier_service_id, "ups-ground");
  assert.equal(body.destination_address.contact_email, "buyer@example.com");
  const calls: Array<{ url: string; key?: string }> = [];
  const pdf = Buffer.from("%PDF-1.4\nlabel").toString("base64");
  const result = await executeEasyshipLabelPurchase({
    host: "https://example.test",
    key: "prod_test",
    idempotencyKey: "easyship-ups:order-1:ups-ground:2115:a1",
    shipmentBody: body,
    courierServiceId: "ups-ground",
    fetchImpl: async (url, init) => {
      const headers = new Headers(init?.headers);
      calls.push({ url: String(url), key: headers.get("Idempotency-Key") ?? undefined });
      if (String(url).endsWith("/shipments")) {
        return Response.json({ shipment: { easyship_shipment_id: "shp-1" } });
      }
      return Response.json({
        shipment: {
          easyship_shipment_id: "shp-1",
          label_state: "generated",
          tracking_page_url: "https://www.ups.com/track?tracknum=1Z999AA10123456784",
          courier_service: { id: "ups-ground", name: "UPS Ground", umbrella_name: "UPS" },
          rates: [{ total_charge: 21.15, currency: "USD" }],
          trackings: [{ tracking_number: "1Z999AA10123456784" }],
          shipping_documents: [{ id: "doc-1", category: "label", format: "pdf", url: "https://labels.example/label.pdf", base64_encoded_strings: [pdf] }],
        },
      });
    },
  });
  assert.equal(result.ok, true);
  assert.equal(calls[0].url, "https://example.test/2024-09/shipments");
  assert.equal(calls[0].key, "easyship-ups:order-1:ups-ground:2115:a1");
  assert.equal(calls[1].url, "https://example.test/2024-09/shipments/shp-1/label");
  assert.equal(calls[1].key, "easyship-ups:order-1:ups-ground:2115:a1:label");
  if (result.ok) {
    assert.equal(result.label.trackingNumber, "1Z999AA10123456784");
    assert.equal(result.label.labelDocumentId, "doc-1");
    assert.equal(labelPdfReady(result.label.labelPdfBase64), true);
  }
  assert.equal(labelPdfReady("not-a-pdf"), false);
});

test("a failed label call keeps the shipment id and a USPS label is rejected", async () => {
  const calls: string[] = [];
  const failed = await executeEasyshipLabelPurchase({
    host: "https://example.test",
    key: "prod_test",
    idempotencyKey: "same",
    shipmentBody: {},
    courierServiceId: "ups-ground",
    existingShipmentId: "shp-keep",
    fetchImpl: async (url) => {
      calls.push(String(url));
      return Response.json({ error: { message: "no label" } }, { status: 422 });
    },
  });
  assert.equal(failed.ok, false);
  if (!failed.ok) assert.equal(failed.shipmentId, "shp-keep");
  assert.equal(calls.length, 1);
  assert.match(calls[0], /shp-keep\/label$/);
  const wrong = parseEasyshipLabelResponse({
    shipment: { easyship_shipment_id: "shp-2", courier_service: { umbrella_name: "USPS", id: "usps-1" }, shipping_documents: [] },
  });
  assert.equal(wrong?.umbrella, "USPS");
  const rejected = await executeEasyshipLabelPurchase({
    host: "https://example.test",
    key: "prod_test",
    idempotencyKey: "same",
    shipmentBody: {},
    courierServiceId: "usps-1",
    existingShipmentId: "shp-2",
    fetchImpl: async () => Response.json({ shipment: { easyship_shipment_id: "shp-2", courier_service: { id: "usps-1", umbrella_name: "USPS" } } }),
  });
  assert.equal(rejected.ok, false);
});

test("purchase stays blocked and does not call the carrier while the flag is off", async () => {
  const gate = purchaseRequestGate({ purchasesEnabled: false, confirm: EASYSHIP_UPS_LABEL_CONFIRM, order });
  const ran = await beginLabelPurchase(gate, async () => {
    throw new Error("postage was requested");
  });
  assert.equal(ran.called, false);
  if (!ran.called) assert.match(ran.error, /founder approval/);
  const source = readFileSync(new URL("./easyship-label-actions.ts", import.meta.url), "utf8");
  const purchase = source.slice(source.indexOf("export async function purchaseUpsLabel"));
  const gateAt = purchase.indexOf("purchaseRequestGate");
  const quoteAt = purchase.indexOf("quoteOrder");
  const buyAt = purchase.indexOf("executeEasyshipLabelPurchase");
  assert.ok(gateAt >= 0 && gateAt < quoteAt && quoteAt < buyAt);
});

test("the confirmation phrase and one paid UPS parcel are required before a purchase", async () => {
  const wrong = purchaseRequestGate({ purchasesEnabled: true, confirm: "buy it", order });
  assert.equal(wrong.ok, false);
  const unpaid = purchaseRequestGate({ purchasesEnabled: true, confirm: EASYSHIP_UPS_LABEL_CONFIRM, order: { ...order, paymentStatus: "pending" } });
  assert.equal(unpaid.ok, false);
  const usps = purchaseRequestGate({ purchasesEnabled: true, confirm: EASYSHIP_UPS_LABEL_CONFIRM, order: { ...order, provider: "usps", service: "USPS Ground" } });
  assert.equal(usps.ok, false);
  const pickup = purchaseRequestGate({ purchasesEnabled: true, confirm: EASYSHIP_UPS_LABEL_CONFIRM, order: { ...order, fulfillmentMethod: "local_pickup", provider: "pickup" } });
  assert.equal(pickup.ok, false);
  const local = purchaseRequestGate({ purchasesEnabled: true, confirm: EASYSHIP_UPS_LABEL_CONFIRM, order: { ...order, provider: "store" } });
  assert.equal(local.ok, false);
  const open = purchaseRequestGate({ purchasesEnabled: true, confirm: EASYSHIP_UPS_LABEL_CONFIRM, order });
  assert.equal(open.ok, true);
  const ran = await beginLabelPurchase(wrong, async () => "charged");
  assert.equal(ran.called, false);
});
