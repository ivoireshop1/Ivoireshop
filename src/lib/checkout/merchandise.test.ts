import assert from "node:assert/strict";
import { test } from "node:test";
import { quoteFromAuthoritativeParts } from "../payments/totals.ts";
import {
  CHECKOUT_PRICE_UNCONFIRMED,
  CHECKOUT_QUANTITY_INVALID,
  confirmedShippingCents,
  merchandiseSubtotalCents,
} from "./merchandise.ts";

test("an 8.50 product stays 850 cents and shipping stays separate", () => {
  const merchandise = merchandiseSubtotalCents([{ price: 8.5, quantity: 1 }]);
  assert.equal(merchandise.ok, true);
  if (!merchandise.ok) return;
  assert.equal(merchandise.subtotalCents, 850);
  assert.equal(confirmedShippingCents(0), 0);
  const quote = quoteFromAuthoritativeParts({
    unitPrices: [{ price: "8.50", quantity: 1 }],
    shippingAmount: 0,
    tax: { tax_mode: "no_tax", tax_rate_percent: null, tax_applies_to_shipping: false, tax_name: "Tax" },
  });
  assert.equal(quote.subtotalCents, 850);
  assert.equal(quote.shippingCents, 0);
  assert.equal(quote.totalCents, 850);
});

test("a missing or failed product price is not a valid $0.00 subtotal", () => {
  for (const price of [null, undefined, "", "NaN", 0, -1]) {
    const result = merchandiseSubtotalCents([{ price, quantity: 1 }]);
    assert.equal(result.ok, false);
    if (result.ok) continue;
    assert.equal(result.error, CHECKOUT_PRICE_UNCONFIRMED);
  }
  assert.throws(
    () => quoteFromAuthoritativeParts({
      unitPrices: [{ price: null, quantity: 1 }],
      shippingAmount: 0,
      tax: { tax_mode: "no_tax", tax_rate_percent: null, tax_applies_to_shipping: false, tax_name: "Tax" },
    }),
    (error: unknown) => error instanceof Error && error.message === CHECKOUT_PRICE_UNCONFIRMED,
  );
});

test("invalid quantities and unconfirmed shipping are refused", () => {
  const quantity = merchandiseSubtotalCents([{ price: 8.5, quantity: 0 }]);
  assert.equal(quantity.ok, false);
  if (!quantity.ok) assert.equal(quantity.error, CHECKOUT_QUANTITY_INVALID);
  assert.equal(confirmedShippingCents(null), null);
  assert.equal(confirmedShippingCents("free"), null);
  assert.equal(confirmedShippingCents(4.25), 425);
});
