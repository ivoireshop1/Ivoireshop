import assert from "node:assert/strict";
import { test } from "node:test";
import { ivoireCueSrc, toneForEvent } from "./ivoire-tones.ts";

test("maps order events to short local cue files", () => {
  assert.equal(toneForEvent("order_confirmed"), "accepted");
  assert.equal(toneForEvent("preparing"), "preparing");
  assert.equal(toneForEvent("ready_for_pickup"), "ready");
  assert.equal(toneForEvent("shipped"), "ready");
  assert.equal(toneForEvent("completed"), "success");
  assert.equal(toneForEvent("announcement"), null);
  assert.equal(ivoireCueSrc.ready, "/api/ivoire-sound/ready");
  assert.equal(ivoireCueSrc.welcome, "/api/ivoire-sound/welcome");
});
