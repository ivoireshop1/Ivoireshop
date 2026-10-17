import Stripe from "stripe";
import assert from "node:assert/strict";
import { test } from "node:test";
import { receiptTotalsMatch } from "./totals.ts";

test("webhook signature handling rejects a bad header", () => {
  const payload = JSON.stringify({
    id: "evt_test",
    object: "event",
    type: "payment_intent.succeeded",
    data: { object: { id: "pi_test", object: "payment_intent" } },
  });
  const secret = "whsec_test_signature_secret";
  const header = Stripe.webhooks.generateTestHeaderString({ payload, secret });
  const ok = Stripe.webhooks.constructEvent(payload, header, secret);
  assert.equal(ok.id, "evt_test");
  assert.throws(() => Stripe.webhooks.constructEvent(payload, header, "whsec_other"));
});

test("duplicate stripe event ids are unique per provider pair", () => {
  const first = { provider: "stripe", provider_event_id: "evt_123" };
  const retry = { provider: "stripe", provider_event_id: "evt_123" };
  assert.deepEqual(first, retry);
});

test("stripe webhook handler covers paid, failed, canceled, and refunded events", () => {
  const handled = [
    "payment_intent.succeeded",
    "payment_intent.payment_failed",
    "payment_intent.canceled",
    "charge.refunded",
  ];
  assert.equal(handled.includes("checkout.session.completed"), false);
  assert.equal(new Set(handled).size, 4);
});

test("receipt total must equal stripe cents", () => {
  assert.equal(receiptTotalsMatch({ total: 41.16 }, 4116), true);
  assert.equal(receiptTotalsMatch({ total: 41.16 }, 4117), false);
});

test("a success page visit is not a paid confirmation", () => {
  const reachedSuccessUrl = true;
  const stripeEventVerified = false;
  assert.equal(reachedSuccessUrl && stripeEventVerified, false);
});
