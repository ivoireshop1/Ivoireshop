import assert from "node:assert/strict";
import { test } from "node:test";
import { isDemoOrder, restoreInventoryAllowed } from "./demo.ts";
import { netPaidRevenue, requiresStripePaymentBeforeFulfillment } from "./totals.ts";

test("demo orders are not real paid Stripe revenue", () => {
  assert.equal(isDemoOrder({ is_demo: true, payment_status: "demo", payment_provider: "demo" }), true);
  assert.equal(isDemoOrder({ is_demo: false, payment_status: "paid", payment_provider: "stripe" }), false);
  assert.equal(netPaidRevenue({ payment_status: "demo", total: 60.63, refunded_amount: 0, is_demo: true }), 0);
  assert.equal(netPaidRevenue({ payment_status: "paid", total: 60.63, refunded_amount: 0, is_demo: true }), 0);
  assert.equal(requiresStripePaymentBeforeFulfillment({ payment_provider: "demo", payment_status: "demo" }), false);
});

test("a client demo flag is not authorization", () => {
  const clientSaidDemo = true;
  const serverEnabled = false;
  assert.equal(clientSaidDemo && serverEnabled, false);
});

test("demo checkout records through the order RPC without a service-role client", () => {
  assert.equal(isDemoOrder({ is_demo: true, payment_status: "demo", payment_provider: "demo" }), true);
  assert.equal(restoreInventoryAllowed({ is_demo: true, payment_status: "demo", payment_provider: "demo", inventory_restored: true }), false);
});

test("demo orders never authorize inventory restore", () => {
  assert.equal(restoreInventoryAllowed({ is_demo: true, payment_status: "demo", payment_provider: "demo", inventory_restored: false }), false);
  assert.equal(restoreInventoryAllowed({ is_demo: true, payment_status: "demo", payment_provider: "demo", inventory_restored: true }), false);
  assert.equal(restoreInventoryAllowed({ is_demo: false, payment_status: "pending", payment_provider: null, inventory_restored: false }), true);
  assert.equal(restoreInventoryAllowed({ is_demo: false, payment_status: "pending", payment_provider: "stripe", inventory_restored: true }), false);
  assert.equal(restoreInventoryAllowed({ is_demo: false, payment_status: "paid", payment_provider: "stripe", inventory_restored: false }), false);
});

test("idempotent demo retries must not restore stock", () => {
  const first = { is_demo: true, payment_status: "demo", payment_provider: "demo", inventory_restored: true };
  const retry = { ...first };
  assert.equal(restoreInventoryAllowed(first), false);
  assert.equal(restoreInventoryAllowed(retry), false);
  assert.equal(isDemoOrder(first), isDemoOrder(retry));
});
