import assert from "node:assert/strict";
import { test } from "node:test";
import { checkoutQuoteFingerprint, quoteResponseIsCurrent } from "./quote-freshness.ts";

test("stale quote responses are rejected when the cart or destination changed", () => {
  const us = {
    addressLine1: "1 Main St",
    city: "Clayton",
    state: "OH",
    postalCode: "45315",
    country: "US",
  };
  const six = [
    { productId: "rice", quantity: 1 },
    { productId: "fufu", quantity: 1 },
    { productId: "leaves", quantity: 1 },
    { productId: "flour", quantity: 1 },
    { productId: "beef", quantity: 1 },
    { productId: "beans", quantity: 1 },
  ];
  const fingerprint = checkoutQuoteFingerprint(us, six);
  assert.equal(quoteResponseIsCurrent({ seq: 2, fingerprint }, { seq: 2, fingerprint }), true);
  assert.equal(quoteResponseIsCurrent({ seq: 2, fingerprint }, { seq: 3, fingerprint }), false);
  assert.equal(quoteResponseIsCurrent(
    { seq: 2, fingerprint },
    { seq: 2, fingerprint: checkoutQuoteFingerprint(us, six.slice(0, 2)) },
  ), false);
  assert.notEqual(
    checkoutQuoteFingerprint(us, six),
    checkoutQuoteFingerprint({ ...us, postalCode: "M5V 2T6", country: "CA", city: "Toronto", state: "ON" }, six),
  );
});
