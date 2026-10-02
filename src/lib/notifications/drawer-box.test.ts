import assert from "node:assert/strict";
import { test } from "node:test";
import { notificationDrawerBox } from "./drawer-box.ts";

test("admin left-sidebar bell stays inside a 768 viewport", () => {
  const box = notificationDrawerBox({ left: 220, right: 264, bottom: 72 }, 768, 1024);
  assert.ok(box.left >= 12);
  assert.ok(box.left + box.width <= 756);
  assert.ok(box.width <= 320);
});

test("tablet 820 does not clip the left edge", () => {
  const box = notificationDrawerBox({ left: 228, right: 272, bottom: 80 }, 820, 1180);
  assert.equal(box.left >= 12, true);
  assert.equal(box.left + box.width <= 808, true);
});

test("phone 390 keeps the drawer inside the viewport", () => {
  const box = notificationDrawerBox({ left: 330, right: 374, bottom: 64 }, 390, 844);
  assert.ok(box.left >= 12);
  assert.ok(box.left + box.width <= 378);
  assert.ok(box.width <= 320);
});
