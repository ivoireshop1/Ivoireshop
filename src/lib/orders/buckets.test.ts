import assert from "node:assert/strict";
import { test } from "node:test";
import { isAdminNewOrder, isCustomerCurrentOrder, adminOrderView } from "./buckets.ts";

test("new orders need owner attention, not an arbitrary date window", () => {
  assert.equal(isAdminNewOrder("pending"), true);
  assert.equal(isAdminNewOrder("confirmed"), false);
  assert.equal(isAdminNewOrder("processing"), false);
  assert.equal(adminOrderView("confirmed"), "in_progress");
  assert.equal(adminOrderView("ready_for_delivery"), "in_progress");
  assert.equal(adminOrderView("delivered"), "completed");
  assert.equal(adminOrderView("cancelled"), "cancelled");
});

test("customer current vs past uses status, not age", () => {
  assert.equal(isCustomerCurrentOrder("processing", "paid"), true);
  assert.equal(isCustomerCurrentOrder("ready_for_pickup", "pending"), true);
  assert.equal(isCustomerCurrentOrder("shipped", "paid"), true);
  assert.equal(isCustomerCurrentOrder("delivered", "paid"), false);
  assert.equal(isCustomerCurrentOrder("cancelled", "paid"), false);
  assert.equal(isCustomerCurrentOrder("processing", "refunded"), false);
});
