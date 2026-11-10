import assert from "node:assert/strict";
import { test } from "node:test";
import { redactShippingDiagnostics } from "./redact.ts";

test("shipping diagnostics redact keys, emails, and address fields", () => {
  const redacted = redactShippingDiagnostics({
    message: "Bearer prod_secretvalue failed for jane@example.com",
    address_line_1: "1 Main St",
    city: "Clayton",
    rates: 2,
  }) as Record<string, unknown>;
  assert.equal(redacted.address_line_1, "[redacted]");
  assert.equal(redacted.city, "[redacted]");
  assert.equal(redacted.rates, 2);
  assert.match(String(redacted.message), /\[redacted\]/);
  assert.doesNotMatch(String(redacted.message), /prod_secretvalue|jane@example.com/);
});
