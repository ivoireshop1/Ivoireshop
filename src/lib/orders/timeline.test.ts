import assert from "node:assert/strict";
import { test } from "node:test";
import { buildOrderTimeline } from "./timeline.ts";

test("pickup timeline omits out for delivery", () => {
  const steps = buildOrderTimeline({
    status: "ready_for_pickup",
    fulfillment_method: "local_pickup",
    created_at: "2026-10-01T12:00:00.000Z",
    events: [{ status: "processing", created_at: "2026-10-01T12:10:00.000Z" }],
  });
  assert.deepEqual(steps.map((step) => step.id), ["accepted", "preparing", "ready", "completed"]);
  assert.equal(steps.find((step) => step.id === "ready")?.current, true);
  assert.equal(steps.find((step) => step.id === "preparing")?.at, "2026-10-01T12:10:00.000Z");
  assert.equal(steps.find((step) => step.id === "completed")?.at, null);
});

test("carrier timeline uses shipped then in transit without auto-completing transit", () => {
  const steps = buildOrderTimeline({
    status: "shipped",
    fulfillment_method: "delivery",
    fulfillment_provider: "ups",
    created_at: "2026-10-01T12:00:00.000Z",
    events: [{ status: "shipped", created_at: "2026-10-01T14:00:00.000Z" }],
  });
  assert.deepEqual(steps.map((step) => step.label), [
    "Order Accepted",
    "Preparing",
    "Shipped",
    "In Transit",
    "Delivered",
  ]);
  assert.equal(steps.find((step) => step.id === "shipped")?.done, true);
  assert.equal(steps.find((step) => step.id === "shipped")?.current, false);
  assert.equal(steps.find((step) => step.id === "transit")?.done, false);
  assert.equal(steps.find((step) => step.id === "transit")?.current, true);
  assert.equal(steps.find((step) => step.id === "transit")?.at, null);
});

test("local delivery includes ready then out for delivery", () => {
  const steps = buildOrderTimeline({
    status: "ready_for_delivery",
    fulfillment_method: "delivery",
    fulfillment_provider: "store",
    created_at: "2026-10-01T12:00:00.000Z",
  });
  assert.deepEqual(steps.map((step) => step.label), [
    "Order Accepted",
    "Preparing",
    "Ready for Delivery",
    "Out for Delivery",
    "Delivered / Completed",
  ]);
  assert.equal(steps.find((step) => step.id === "ready")?.current, true);
});
