import assert from "node:assert/strict";
import { test } from "node:test";
import { buildOrderTimeline } from "./timeline.ts";

test("pickup timeline shows placed through completed without out for delivery", () => {
  const steps = buildOrderTimeline({
    status: "ready_for_pickup",
    fulfillment_method: "local_pickup",
    created_at: "2026-10-01T12:00:00.000Z",
    events: [
      { status: "confirmed", created_at: "2026-10-01T12:05:00.000Z" },
      { status: "processing", created_at: "2026-10-01T12:10:00.000Z" },
    ],
  });
  assert.deepEqual(steps.map((step) => step.id), ["placed", "accepted", "preparing", "ready", "completed"]);
  assert.equal(steps.find((step) => step.id === "ready")?.current, true);
  assert.equal(steps.find((step) => step.id === "preparing")?.at, "2026-10-01T12:10:00.000Z");
  assert.equal(steps.find((step) => step.id === "completed")?.at, null);
});

test("carrier timeline uses awaiting drop-off and shipped without inventing in transit", () => {
  const steps = buildOrderTimeline({
    status: "shipped",
    fulfillment_method: "delivery",
    fulfillment_provider: "ups",
    created_at: "2026-10-01T12:00:00.000Z",
    events: [{ status: "shipped", created_at: "2026-10-01T14:00:00.000Z" }],
  });
  assert.deepEqual(steps.map((step) => step.label), [
    "Order Placed",
    "Accepted",
    "Preparing",
    "Awaiting Carrier Drop-Off",
    "Shipped",
    "Delivered",
  ]);
  assert.equal(steps.find((step) => step.id === "shipped")?.done, true);
  assert.equal(steps.find((step) => step.id === "shipped")?.current, true);
  assert.equal(steps.some((step) => step.label === "In Transit"), false);
  assert.equal(steps.find((step) => step.id === "completed")?.done, false);
});

test("local delivery includes ready then out for delivery", () => {
  const steps = buildOrderTimeline({
    status: "ready_for_delivery",
    fulfillment_method: "delivery",
    fulfillment_provider: "store",
    created_at: "2026-10-01T12:00:00.000Z",
  });
  assert.deepEqual(steps.map((step) => step.label), [
    "Order Placed",
    "Accepted",
    "Preparing",
    "Ready for Delivery",
    "Out for Delivery",
    "Delivered / Completed",
  ]);
  assert.equal(steps.find((step) => step.id === "ready")?.current, true);
});
