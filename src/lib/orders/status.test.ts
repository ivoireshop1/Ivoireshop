import assert from "node:assert/strict";
import { test } from "node:test";
import { nextOrderActionLabel, nextOrderStatuses } from "./status.ts";

test("carrier orders wait for tracking instead of a shipped dropdown", () => {
  assert.deepEqual(nextOrderStatuses("processing", "delivery", "ups"), ["ready_for_delivery", "cancelled"]);
  assert.deepEqual(nextOrderStatuses("ready_for_delivery", "delivery", "ups"), ["cancelled"]);
  assert.deepEqual(nextOrderStatuses("shipped", "delivery", "ups"), []);
  assert.equal(nextOrderActionLabel("ready_for_delivery", "delivery", "ups"), "Ready for Carrier");
});

test("pickup and local delivery keep explicit next actions", () => {
  assert.equal(nextOrderActionLabel("confirmed", "local_pickup"), "Accept Order");
  assert.equal(nextOrderActionLabel("ready_for_pickup", "local_pickup"), "Ready for Pickup");
  assert.equal(nextOrderActionLabel("delivered", "local_pickup"), "Mark Picked Up");
  assert.deepEqual(nextOrderStatuses("ready_for_delivery", "delivery", "store"), ["shipped", "cancelled"]);
  assert.equal(nextOrderActionLabel("shipped", "delivery", "store"), "Out for Delivery");
});
