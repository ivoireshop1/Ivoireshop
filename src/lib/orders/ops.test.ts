import assert from "node:assert/strict";
import { test } from "node:test";
import {
  dashboardFulfillmentCounts,
  fulfillmentChecklist,
  fulfillmentKindLabel,
  INTERNAL_NOTES_CUSTOMER_ACCESS,
  ITEM_PICKS_CUSTOMER_ACCESS,
  orderAttention,
  orderMatchesOpsFilters,
  orderMatchesSearch,
  paymentHeaderLabel,
  pickingProgress,
  trackingRequiredMissing,
} from "./ops.ts";
import { nextOrderStatuses } from "./status.ts";

test("lifecycle guards block placed to completed", () => {
  assert.equal(nextOrderStatuses("pending", "local_pickup").includes("delivered"), false);
  assert.equal(nextOrderStatuses("pending", "delivery", "store").includes("delivered"), false);
  assert.equal(nextOrderStatuses("pending", "delivery", "ups").includes("shipped"), false);
  assert.equal(nextOrderStatuses("shipped", "delivery", "ups").includes("delivered"), false);
  assert.deepEqual(nextOrderStatuses("ready_for_pickup", "local_pickup").filter((value) => value !== "cancelled"), ["delivered"]);
  assert.deepEqual(nextOrderStatuses("shipped", "delivery", "store"), ["delivered"]);
});

test("picking progress is derived from line counts", () => {
  assert.equal(pickingProgress(3, 2).label, "2 of 3 items picked");
  assert.equal(pickingProgress(3, 3).label, "3 of 3 items picked ✓");
  assert.equal(pickingProgress(3, 3).complete, true);
});

test("internal ops data is not customer-accessible by design", () => {
  assert.equal(INTERNAL_NOTES_CUSTOMER_ACCESS, false);
  assert.equal(ITEM_PICKS_CUSTOMER_ACCESS, false);
});

test("attention states derive from order status", () => {
  assert.equal(orderAttention({ status: "pending" }), "Needs Acceptance");
  assert.equal(orderAttention({ status: "processing" }), "Preparing");
  assert.equal(orderAttention({ status: "ready_for_pickup" }), "Ready for Pickup");
  assert.equal(orderAttention({ status: "ready_for_delivery", fulfillment_method: "delivery", fulfillment_provider: "store" }), "Ready for Delivery");
  assert.equal(orderAttention({ status: "ready_for_delivery", fulfillment_provider: "ups" }), "Awaiting Tracking");
  assert.equal(orderAttention({ status: "ready_for_delivery", fulfillment_provider: "ups", tracking_number: "1Z" }), null);
  assert.equal(orderAttention({ status: "shipped", fulfillment_provider: "store" }), "Out for Delivery");
  assert.equal(trackingRequiredMissing({ status: "ready_for_delivery", fulfillment_provider: "usps" }), true);
});

test("dashboard fulfillment counts follow attention", () => {
  const counts = dashboardFulfillmentCounts([
    { status: "pending" },
    { status: "processing" },
    { status: "ready_for_pickup" },
    { status: "ready_for_delivery", fulfillment_method: "delivery", fulfillment_provider: "store" },
    { status: "ready_for_delivery", fulfillment_provider: "ups" },
    { status: "shipped", fulfillment_provider: "store" },
  ]);
  assert.equal(counts.needsAcceptance, 1);
  assert.equal(counts.preparing, 1);
  assert.equal(counts.readyPickup, 1);
  assert.equal(counts.readyDelivery, 1);
  assert.equal(counts.awaitingTracking, 1);
  assert.equal(counts.outForDelivery, 1);
});

test("order search covers number, contact, and tracking", () => {
  const order = {
    order_number: "IVO-1001",
    customer_name: "Ada",
    customer_email: "ada@example.com",
    customer_phone: "3138259887",
    tracking_number: "1Z999AA10123456784",
  };
  assert.equal(orderMatchesSearch(order, "IVO-1001"), true);
  assert.equal(orderMatchesSearch(order, "ada@"), true);
  assert.equal(orderMatchesSearch(order, "313825"), true);
  assert.equal(orderMatchesSearch(order, "1Z999"), true);
  assert.equal(orderMatchesSearch(order, "missing"), false);
});

test("fulfillment and payment filters", () => {
  const pickup = { status: "pending", fulfillment_method: "local_pickup", payment_status: "pending", created_at: "2026-10-02T18:00:00.000Z" };
  const ups = { status: "ready_for_delivery", fulfillment_method: "delivery", fulfillment_provider: "ups", payment_status: "paid", created_at: "2026-10-02T18:00:00.000Z" };
  assert.equal(orderMatchesOpsFilters(pickup, { fulfillment: "local_pickup" }), true);
  assert.equal(orderMatchesOpsFilters(ups, { carrier: "ups", payment: "paid" }), true);
  assert.equal(orderMatchesOpsFilters(ups, { carrier: "usps" }), false);
  assert.equal(paymentHeaderLabel("paid"), "Paid");
  assert.equal(paymentHeaderLabel("pending"), "Unpaid");
  assert.equal(paymentHeaderLabel("pending", "square"), "Payment Pending");
  assert.equal(fulfillmentKindLabel("local_pickup"), "Store Pickup");
  assert.equal(fulfillmentKindLabel("delivery", "usps"), "USPS");
});

test("checklist is derived from real status and payment", () => {
  const pickup = fulfillmentChecklist({ status: "processing", payment_status: "paid", fulfillment_method: "local_pickup" });
  assert.equal(pickup.find((item) => item.id === "payment")?.done, true);
  assert.equal(pickup.find((item) => item.id === "preparing")?.done, true);
  assert.equal(pickup.find((item) => item.id === "ready")?.done, false);
  const carrier = fulfillmentChecklist({ status: "ready_for_delivery", payment_status: "paid", fulfillment_provider: "ups" });
  assert.equal(carrier.find((item) => item.id === "tracking")?.done, false);
  assert.equal(carrier.find((item) => item.id === "shipped")?.done, false);
});
