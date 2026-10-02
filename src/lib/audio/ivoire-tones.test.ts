import test from "node:test";
import assert from "node:assert/strict";
import { toneForEvent } from "./ivoire-tones.ts";

test("maps admin and customer events to existing cues", () => {
  assert.equal(toneForEvent("new_order"), "accepted");
  assert.equal(toneForEvent("order_confirmed"), "accepted");
  assert.equal(toneForEvent("customer_message"), "preparing");
  assert.equal(toneForEvent("new_review"), "preparing");
  assert.equal(toneForEvent("shipping_attention"), "ready");
  assert.equal(toneForEvent("preparing"), "preparing");
  assert.equal(toneForEvent("completed"), "success");
  assert.equal(toneForEvent("tracking_added"), "ready");
});
