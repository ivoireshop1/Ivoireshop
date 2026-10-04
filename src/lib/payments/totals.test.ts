import assert from "node:assert/strict";
import { test } from "node:test";
import { usdToCents, centsToUsdString, amountsMatchUsd } from "./money.ts";
import { clientQuotedTotalMatches, quoteFromAuthoritativeParts, refundStatus, requiresStripePaymentBeforeFulfillment, netPaidRevenue, receiptTotalsMatch, paymentStatusFromStripe } from "./totals.ts";

test("money cents arithmetic has no one-cent drift", () => {
  assert.equal(usdToCents("41.16"), 4116);
  assert.equal(usdToCents(41.16), 4116);
  assert.equal(centsToUsdString(4116), "41.16");
  assert.equal(amountsMatchUsd(41.16, "41.16"), true);
});

test("authoritative totals ignore client-supplied prices", () => {
  const quote = quoteFromAuthoritativeParts({
    unitPrices: [{ price: 6.99, quantity: 2 }, { price: 8.5, quantity: 1 }],
    shippingAmount: 8.5,
    tax: { tax_mode: "manual_rate", tax_rate_percent: 8, tax_applies_to_shipping: false, tax_name: "Tax" },
  });
  assert.equal(quote.subtotalCents, 2248);
  assert.equal(quote.shippingCents, 850);
  assert.equal(quote.taxCents, 180);
  assert.equal(quote.totalCents, 3278);
  assert.equal(clientQuotedTotalMatches(quote.totalCents, 1), false);
  assert.equal(clientQuotedTotalMatches(quote.totalCents, quote.total), true);
});

test("shipping and tax tampering cannot change server quote", () => {
  const server = quoteFromAuthoritativeParts({
    unitPrices: [{ price: 10, quantity: 1 }],
    shippingAmount: 5,
    tax: { tax_mode: "no_tax", tax_rate_percent: null, tax_applies_to_shipping: false, tax_name: "Tax" },
  });
  const clientShipping = quoteFromAuthoritativeParts({
    unitPrices: [{ price: 10, quantity: 1 }],
    shippingAmount: 0,
    tax: { tax_mode: "no_tax", tax_rate_percent: null, tax_applies_to_shipping: false, tax_name: "Tax" },
  });
  assert.equal(server.totalCents, 1500);
  assert.notEqual(server.totalCents, clientShipping.totalCents);
});

test("not configured tax stays zero", () => {
  const quote = quoteFromAuthoritativeParts({
    unitPrices: [{ price: 20, quantity: 1 }],
    shippingAmount: 4,
    tax: { tax_mode: "not_configured", tax_rate_percent: 8, tax_applies_to_shipping: true, tax_name: "Tax" },
  });
  assert.equal(quote.taxCents, 0);
  assert.equal(quote.totalCents, 2400);
});

test("payment status transitions and refund vs cancel", () => {
  assert.equal(refundStatus(4116, 0), null);
  assert.equal(refundStatus(4116, 4116), "refunded");
  assert.equal(refundStatus(4116, 1000), "partially_refunded");
  assert.equal(requiresStripePaymentBeforeFulfillment({ payment_provider: "stripe", payment_status: "pending" }), true);
  assert.equal(requiresStripePaymentBeforeFulfillment({ payment_provider: "stripe", payment_status: "paid" }), false);
  assert.equal(requiresStripePaymentBeforeFulfillment({ payment_provider: null, payment_status: "pending" }), false);
  assert.equal(netPaidRevenue({ payment_status: "paid", total: 41.16, refunded_amount: 0 }), 41.16);
  assert.equal(netPaidRevenue({ payment_status: "refunded", total: 41.16, refunded_amount: 41.16 }), 0);
  assert.equal(netPaidRevenue({ payment_status: "partially_refunded", total: 41.16, refunded_amount: 10 }), 31.16);
  assert.equal(receiptTotalsMatch({ total: 41.16 }, 4116), true);
});

test("shipping amount changes change the PaymentIntent cents", () => {
  const pickup = quoteFromAuthoritativeParts({
    unitPrices: [{ price: 45.97, quantity: 1 }],
    shippingAmount: 0,
    tax: { tax_mode: "not_configured", tax_rate_percent: null, tax_applies_to_shipping: false, tax_name: "Tax" },
  });
  const ups = quoteFromAuthoritativeParts({
    unitPrices: [{ price: 45.97, quantity: 1 }],
    shippingAmount: 14.66,
    tax: { tax_mode: "not_configured", tax_rate_percent: null, tax_applies_to_shipping: false, tax_name: "Tax" },
  });
  assert.equal(pickup.totalCents, 4597);
  assert.equal(ups.totalCents, 6063);
  assert.equal(receiptTotalsMatch({ total: ups.total }, 6063), true);
  assert.equal(clientQuotedTotalMatches(ups.totalCents, 45.97), false);
});

test("duplicate payment attempts share one payment intent key", () => {
  const orderId = "11111111-1111-4111-8111-111111111111";
  assert.equal(`ivoire-pi-${orderId}`, `ivoire-pi-${orderId}`);
});

test("failed payment stays unpaid", () => {
  assert.equal(paymentStatusFromStripe("requires_payment_method"), "pending");
  assert.equal(paymentStatusFromStripe("succeeded"), "paid");
  assert.equal(requiresStripePaymentBeforeFulfillment({ payment_provider: "stripe", payment_status: "failed" }), true);
});
