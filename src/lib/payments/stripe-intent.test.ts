import assert from "node:assert/strict";
import { test } from "node:test";
import { nextStripeIntentAction, stripeIntentIdempotencyKey } from "./stripe-intent.ts";

test("succeeded PaymentIntents are treated as paid even if the order row is still pending", () => {
  assert.equal(nextStripeIntentAction({ orderPaid: false, intentStatus: "succeeded" }), "already_paid");
  assert.equal(nextStripeIntentAction({ orderPaid: true, intentStatus: "requires_payment_method" }), "already_paid");
});

test("open PaymentIntents resume instead of creating a second charge", () => {
  assert.equal(nextStripeIntentAction({ orderPaid: false, intentStatus: "requires_payment_method" }), "resume");
  assert.equal(nextStripeIntentAction({ orderPaid: false, intentStatus: "requires_confirmation" }), "resume");
  assert.equal(nextStripeIntentAction({ orderPaid: false, intentStatus: "requires_action" }), "resume");
});

test("processing waits and canceled or failed intents can start a new PaymentIntent", () => {
  assert.equal(nextStripeIntentAction({ orderPaid: false, intentStatus: "processing" }), "wait");
  assert.equal(nextStripeIntentAction({ orderPaid: false, intentStatus: "canceled" }), "new");
  assert.equal(nextStripeIntentAction({ orderPaid: false }), "new");
});

test("retry idempotency keys stay unique after a canceled PaymentIntent", () => {
  assert.equal(stripeIntentIdempotencyKey("order-1"), "ivoire-pi-order-1");
  assert.equal(stripeIntentIdempotencyKey("order-1", "pi_abc123456789"), "ivoire-pi-order-1-after-abc123456789");
});
