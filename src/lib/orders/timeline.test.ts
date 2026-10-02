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

test("carrier timeline uses shipped without ready for delivery", () => {
  const steps = buildOrderTimeline({
    status: "shipped",
    fulfillment_method: "delivery",
    fulfillment_provider: "ups",
    created_at: "2026-10-01T12:00:00.000Z",
  });
  assert.ok(steps.some((step) => step.label === "Shipped"));
  assert.equal(steps.some((step) => step.id === "ready"), false);
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
