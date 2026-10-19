import assert from "node:assert/strict";
import { test } from "node:test";
import { CUSTOMER_CARD_UNAVAILABLE, customerPaymentMessage, toPublicPaymentConfig } from "./customer-copy.ts";

test("customer payment copy never includes environment or secret names", () => {
  const unavailable = toPublicPaymentConfig({ ready: false, mode: null, liveBlocked: false });
  assert.equal(unavailable.stripeReady, false);
  assert.equal(unavailable.stripeTestMode, false);
  assert.equal(unavailable.paymentUnavailableMessage, CUSTOMER_CARD_UNAVAILABLE);
  const testMode = toPublicPaymentConfig({ ready: true, mode: "test", liveBlocked: false });
  assert.equal(testMode.stripeReady, true);
  assert.equal(testMode.stripeTestMode, true);
  assert.match(testMode.paymentUnavailableMessage, /TEST MODE/);
  const blob = `${JSON.stringify(unavailable)}${JSON.stringify(testMode)}${customerPaymentMessage({ stripeReady: false, testMode: false, liveBlocked: true })}`;
  assert.equal(/STRIPE_|SUPABASE_|WEBHOOK_SECRET|SERVICE_ROLE|NEXT_PUBLIC_/.test(blob), false);
});
