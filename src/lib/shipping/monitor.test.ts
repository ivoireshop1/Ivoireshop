import assert from "node:assert/strict";
import { test } from "node:test";
import { summarizeShippingEvents } from "./monitor-summary.ts";

test("shipping monitor keeps the latest quote failure reason for admin status", () => {
  const summary = summarizeShippingEvents([
    {
      event_type: "quote_failure",
      payload: { reason: "not_configured", carriers: ["ups", "usps"] },
      created_at: "2026-10-20T06:58:30.692Z",
    },
    {
      event_type: "checkout_quote",
      payload: { rates: 0 },
      created_at: "2026-10-19T12:00:00.000Z",
    },
  ]);
  assert.equal(summary.quoteFailures, 1);
  assert.equal(summary.quotes, 1);
  assert.equal(summary.lastFailureReason, "not_configured");
  assert.equal(summary.lastFailureAt, "2026-10-20T06:58:30.692Z");
});

test("shipping monitor leaves failure reason empty when no quote failures exist", () => {
  const summary = summarizeShippingEvents([
    { event_type: "checkout_quote", payload: { rates: 2 }, created_at: "2026-10-20T01:00:00.000Z" },
  ]);
  assert.equal(summary.lastFailureReason, null);
  assert.equal(summary.lastFailureAt, null);
});
