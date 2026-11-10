import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { shipmentMarksShipped, shipmentSaveIntent, shipmentSavePatch } from "./shipment-save.ts";

test("saving tracking does not mark the order shipped or change the customer shipping charge", () => {
  const patch = shipmentSavePatch({
    intent: "tracking",
    tracking: "1Z999AA10123456784",
    alreadyShipped: false,
    postage: 14.2,
    demo: false,
    shippedAt: "2026-11-10T16:00:00.000Z",
  });
  assert.deepEqual(patch, { tracking_number: "1Z999AA10123456784", postage_cost: 14.2 });
  assert.equal("shipping_cost" in patch, false);
  assert.equal("status" in patch, false);
  assert.equal(shipmentMarksShipped("tracking", false), false);
  assert.equal(shipmentSaveIntent("tracking"), "tracking");
  assert.equal(shipmentSaveIntent(undefined), "tracking");
});

test("mark as shipped stays a separate explicit action", () => {
  const patch = shipmentSavePatch({
    intent: "ship",
    tracking: "1Z999AA10123456784",
    alreadyShipped: false,
    postage: null,
    demo: false,
    shippedAt: "2026-11-10T16:00:00.000Z",
  });
  assert.equal(patch.status, "shipped");
  assert.equal(shipmentMarksShipped("ship", false), true);
  assert.equal(shipmentMarksShipped("ship", true), false);
  const source = readFileSync(new URL("../../components/admin/admin-order-shipment-form.tsx", import.meta.url), "utf8");
  assert.match(source, /intent="tracking"/);
  assert.match(source, /Save tracking/);
  assert.match(source, /intent="ship"/);
  assert.match(source, /Mark as shipped/);
  const action = readFileSync(new URL("./actions.ts", import.meta.url), "utf8");
  const start = action.indexOf("export async function saveOrderShipment");
  const save = action.slice(start, action.indexOf("function normalizeStoredTracking", start));
  assert.match(save, /intent === "ship" && !alreadyShipped && \["delivered", "cancelled"\]/);
  assert.equal(save.includes("shipping_cost"), false);
});
