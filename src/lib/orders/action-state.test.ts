import assert from "node:assert/strict";
import { test } from "node:test";
import { adminOrderView, isCustomerCurrentOrder } from "./buckets.ts";
import { nextOrderStatuses } from "./status.ts";

test("accepting a new order moves it to in progress", () => {
  assert.equal(adminOrderView("pending"), "new");
  assert.ok(nextOrderStatuses("pending", "local_pickup").includes("confirmed"));
  assert.equal(adminOrderView("confirmed"), "in_progress");
});

test("delivered and cancelled customer orders are past", () => {
  assert.equal(isCustomerCurrentOrder("processing", "paid"), true);
  assert.equal(isCustomerCurrentOrder("delivered", "paid"), false);
  assert.equal(isCustomerCurrentOrder("cancelled", "paid"), false);
});
