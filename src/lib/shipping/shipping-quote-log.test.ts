import assert from "node:assert/strict";
import { test } from "node:test";
import {
  recordShippingQuoteLog,
  shippingQuoteLogRow,
  shippingQuoteLogStatus,
} from "./shipping-quote-log.ts";

test("quote log row includes weight sources, parcel, message, and status", () => {
  const row = shippingQuoteLogRow({
    usedEstimatedWeight: true,
    usedEstimatedBox: true,
    weightSources: [{ id: "p1", source: "ai_image" }],
    parcel: { weightLb: 2.2, lengthIn: 8, widthIn: 6, heightIn: 4, estimatedBox: true, boxId: "estimate-small-box" },
    message: "estimated_weight_used+estimated_box_used",
    status: "missing_box",
  });
  assert.equal(row.used_estimated_weight, true);
  assert.deepEqual(row.weight_sources, [{ id: "p1", source: "ai_image" }]);
  assert.deepEqual(row.parcel, {
    weightLb: 2.2,
    lengthIn: 8,
    widthIn: 6,
    heightIn: 4,
    estimatedBox: true,
    boxId: "estimate-small-box",
    usedEstimatedBox: true,
  });
  assert.equal(row.message, "estimated_weight_used+estimated_box_used");
  assert.equal(row.status, "missing_box");
});

test("status check values used by quote logging are accepted", () => {
  for (const status of ["ok", "missing_weight", "missing_box", "missing_parcel", "oversized", "overweight", "capacity_exceeded", "no_rate", "error"]) {
    assert.equal(shippingQuoteLogStatus(status), status);
  }
  assert.equal(shippingQuoteLogStatus("not-a-status"), "ok");
  assert.equal(shippingQuoteLogStatus(null), "ok");
});

test("failed quote log insert does not throw and reports console.error", async () => {
  const errors: unknown[] = [];
  const previous = console.error;
  console.error = (...args: unknown[]) => {
    errors.push(args);
  };
  try {
    const result = await recordShippingQuoteLog(
      { usedEstimatedWeight: false, weightSources: [], status: "missing_box" },
      {
        from() {
          return {
            async insert() {
              return { error: { message: "column missing", code: "PGRST204" } };
            },
          };
        },
      },
    );
    assert.equal(result.ok, false);
    if (!result.ok) assert.match(result.error, /column missing/);
    assert.equal(errors.length > 0, true);
  } finally {
    console.error = previous;
  }
});
