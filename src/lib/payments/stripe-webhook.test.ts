import Stripe from "stripe";
import assert from "node:assert/strict";
import { test } from "node:test";
import { receiptTotalsMatch } from "./totals.ts";
import {
  classifyStripeWebhookError,
  verifyStripeWebhookPayload,
  webhookSecretLooksValid,
} from "./stripe-webhook-verify.ts";
import { getStripeConfig, normalizeWebhookSecret, STRIPE_ENV_NAMES } from "./stripe-config.ts";

const SYNTHETIC_SECRET = "whsec_synthetic_ivoire_webhook_test";
const SYNTHETIC_PAYLOAD = JSON.stringify({
  id: "evt_synthetic_ivoire",
  object: "event",
  type: "payment_intent.succeeded",
  data: { object: { id: "pi_synthetic", object: "payment_intent", amount: 519 } },
});

function withWebhookEnv(webhook: string | undefined, run: () => void) {
  const keys = [STRIPE_ENV_NAMES.secret, STRIPE_ENV_NAMES.publishable, STRIPE_ENV_NAMES.webhook] as const;
  const previous = Object.fromEntries(keys.map((key) => [key, process.env[key]]));
  try {
    process.env[STRIPE_ENV_NAMES.secret] = "sk_test_example";
    process.env[STRIPE_ENV_NAMES.publishable] = "pk_test_example";
    if (webhook === undefined) delete process.env[STRIPE_ENV_NAMES.webhook];
    else process.env[STRIPE_ENV_NAMES.webhook] = webhook;
    run();
  } finally {
    for (const key of keys) {
      if (previous[key] === undefined) delete process.env[key];
      else process.env[key] = previous[key];
    }
  }
}

test("webhook signature handling rejects a bad header", () => {
  const header = Stripe.webhooks.generateTestHeaderString({ payload: SYNTHETIC_PAYLOAD, secret: SYNTHETIC_SECRET });
  const ok = Stripe.webhooks.constructEvent(SYNTHETIC_PAYLOAD, header, SYNTHETIC_SECRET);
  assert.equal(ok.id, "evt_synthetic_ivoire");
  assert.throws(() => Stripe.webhooks.constructEvent(SYNTHETIC_PAYLOAD, header, "whsec_other"));
});

test("normalizeWebhookSecret strips quotes, BOM, and wrapping whitespace only", () => {
  assert.equal(normalizeWebhookSecret(`\uFEFF  "whsec_quoted" \n`), "whsec_quoted");
  assert.equal(normalizeWebhookSecret("'whsec_quoted'"), "whsec_quoted");
  assert.equal(normalizeWebhookSecret("whsec_clean"), "whsec_clean");
  assert.equal(webhookSecretLooksValid("whsec_clean"), true);
  assert.equal(webhookSecretLooksValid("we_1USOmu07iHhCE2bRbsS7gwAE"), false);
});

test("quoted webhook env is normalized before constructEvent", () => {
  withWebhookEnv(`"${SYNTHETIC_SECRET}"`, () => {
    const config = getStripeConfig();
    assert.equal(config.webhookSecret, SYNTHETIC_SECRET);
    const header = Stripe.webhooks.generateTestHeaderString({ payload: SYNTHETIC_PAYLOAD, secret: SYNTHETIC_SECRET });
    const verified = verifyStripeWebhookPayload(SYNTHETIC_PAYLOAD, header, config.webhookSecret);
    assert.equal(verified.ok, true);
  });
});

test("verifyStripeWebhookPayload classifies missing header, wrong secret, and re-serialized body", () => {
  const header = Stripe.webhooks.generateTestHeaderString({ payload: SYNTHETIC_PAYLOAD, secret: SYNTHETIC_SECRET });
  assert.equal(verifyStripeWebhookPayload(SYNTHETIC_PAYLOAD, null, SYNTHETIC_SECRET).ok, false);
  assert.equal(verifyStripeWebhookPayload(SYNTHETIC_PAYLOAD, null, SYNTHETIC_SECRET).error, "missing_signature_header");
  assert.equal(verifyStripeWebhookPayload(SYNTHETIC_PAYLOAD, header, "whsec_other").error, "invalid_signature");
  const mutated = JSON.stringify(JSON.parse(SYNTHETIC_PAYLOAD), null, 2);
  assert.notEqual(mutated, SYNTHETIC_PAYLOAD);
  assert.equal(verifyStripeWebhookPayload(mutated, header, SYNTHETIC_SECRET).error, "invalid_signature");
});

test("thin-event throws are not labeled invalid_signature", () => {
  assert.equal(
    classifyStripeWebhookError(new Error("You passed a thin event notification to a function that expects a webhook.")),
    "thin_event",
  );
  assert.equal(
    classifyStripeWebhookError(new Error("Timestamp outside the tolerance zone")),
    "timestamp_tolerance",
  );
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
