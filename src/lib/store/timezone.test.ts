import assert from "node:assert/strict";
import { test } from "node:test";
import { DEFAULT_STORE_TIMEZONE, formatStoreCompact, formatStoreDateTime, formatStoreTime } from "./timezone.ts";

test("store timezone is America/New_York", () => {
  assert.equal(DEFAULT_STORE_TIMEZONE, "America/New_York");
});

test("summer UTC converts to Eastern Daylight Time", () => {
  assert.equal(formatStoreDateTime("2026-10-02T18:58:00.000Z"), "October 2, 2026 at 2:58 PM");
  assert.equal(formatStoreTime("2026-10-02T18:58:00.000Z"), "2:58 PM");
  assert.equal(formatStoreCompact("2026-10-02T18:58:00.000Z"), "Oct 2, 2:58 PM");
});

test("winter UTC converts to Eastern Standard Time", () => {
  assert.equal(formatStoreDateTime("2026-01-15T19:58:00.000Z"), "January 15, 2026 at 2:58 PM");
  assert.equal(formatStoreTime("2026-01-15T19:58:00.000Z"), "2:58 PM");
});
