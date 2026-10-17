import assert from "node:assert/strict";
import { test } from "node:test";
import { clampNotificationVolume, DEFAULT_NOTIFICATION_VOLUME_PERCENT, percentToElementVolume } from "./volume.ts";

test("notification volume clamps to 0-100 and defaults to an audible safe level", () => {
  assert.equal(DEFAULT_NOTIFICATION_VOLUME_PERCENT, 80);
  assert.equal(clampNotificationVolume(-4), 0);
  assert.equal(clampNotificationVolume(140), 100);
  assert.equal(clampNotificationVolume("72.4"), 72);
  assert.equal(clampNotificationVolume("nope"), 80);
  assert.equal(percentToElementVolume(80), 0.8);
  assert.equal(percentToElementVolume(0), 0);
});
