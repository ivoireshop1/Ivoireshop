import assert from "node:assert/strict";
import { test } from "node:test";
import {
  getStripeConfig,
  stripePublishableKeyMode,
  stripeSecretKeyMode,
  STRIPE_ENV_NAMES,
} from "./stripe-config.ts";

const ENV_KEYS = [
  STRIPE_ENV_NAMES.secret,
  STRIPE_ENV_NAMES.publishable,
  STRIPE_ENV_NAMES.webhook,
  STRIPE_ENV_NAMES.liveEnabled,
] as const;

function withStripeEnv(values: Partial<Record<(typeof ENV_KEYS)[number], string | undefined>>, run: () => void) {
  const previous = Object.fromEntries(ENV_KEYS.map((key) => [key, process.env[key]]));
  try {
    for (const key of ENV_KEYS) {
      const next = values[key];
      if (next === undefined) delete process.env[key];
      else process.env[key] = next;
    }
    run();
  } finally {
    for (const key of ENV_KEYS) {
      if (previous[key] === undefined) delete process.env[key];
      else process.env[key] = previous[key];
    }
  }
}

test("stripe diagnostics never require a client-supplied amount and list missing env names", () => {
  withStripeEnv({}, () => {
    const empty = getStripeConfig();
    assert.equal(empty.canCollect, false);
    assert.equal(empty.configured, false);
    assert.equal(empty.invalidKeyType, false);
    assert.deepEqual(empty.missingNames, [STRIPE_ENV_NAMES.publishable, STRIPE_ENV_NAMES.secret, STRIPE_ENV_NAMES.webhook]);
  });
  withStripeEnv({
    [STRIPE_ENV_NAMES.secret]: "sk_test_example",
    [STRIPE_ENV_NAMES.publishable]: "pk_test_example",
  }, () => {
    const collectable = getStripeConfig();
    assert.equal(collectable.canCollect, true);
    assert.equal(collectable.configured, false);
    assert.equal(collectable.mode, "test");
    assert.equal(collectable.invalidKeyType, false);
    assert.deepEqual(collectable.missingNames, [STRIPE_ENV_NAMES.webhook]);
  });
  withStripeEnv({
    [STRIPE_ENV_NAMES.secret]: "sk_test_example",
    [STRIPE_ENV_NAMES.publishable]: "pk_test_example",
    [STRIPE_ENV_NAMES.webhook]: "whsec_example",
  }, () => {
    const full = getStripeConfig();
    assert.equal(full.configured, true);
    assert.equal(full.canCollect, true);
    assert.equal(full.missingNames.length, 0);
    assert.equal(full.public?.mode, "test");
  });
  withStripeEnv({
    [STRIPE_ENV_NAMES.secret]: "sk_live_example",
    [STRIPE_ENV_NAMES.publishable]: "pk_live_example",
    [STRIPE_ENV_NAMES.webhook]: "whsec_example",
  }, () => {
    const liveLocked = getStripeConfig();
    assert.equal(liveLocked.mode, "live");
    assert.equal(liveLocked.liveBlocked, true);
    assert.equal(liveLocked.canCollect, false);
    assert.equal(liveLocked.configured, false);
  });
  withStripeEnv({
    [STRIPE_ENV_NAMES.secret]: "sk_live_example",
    [STRIPE_ENV_NAMES.publishable]: "pk_live_example",
    [STRIPE_ENV_NAMES.webhook]: "whsec_example",
    [STRIPE_ENV_NAMES.liveEnabled]: "true",
  }, () => {
    const liveOpen = getStripeConfig();
    assert.equal(liveOpen.liveBlocked, false);
    assert.equal(liveOpen.canCollect, true);
  });
});

test("pk_test_ in STRIPE_SECRET_KEY is rejected before Stripe is collectable", () => {
  withStripeEnv({
    [STRIPE_ENV_NAMES.secret]: "pk_test_misplaced_publishable",
    [STRIPE_ENV_NAMES.publishable]: "pk_test_example",
    [STRIPE_ENV_NAMES.webhook]: "whsec_example",
  }, () => {
    assert.equal(stripeSecretKeyMode("pk_test_misplaced_publishable"), null);
    assert.equal(stripePublishableKeyMode("pk_test_example"), "test");
    const misplaced = getStripeConfig();
    assert.equal(misplaced.invalidKeyType, true);
    assert.equal(misplaced.mode, null);
    assert.equal(misplaced.canCollect, false);
    assert.equal(misplaced.configured, false);
    assert.equal(misplaced.public, null);
    assert.equal(misplaced.livePaymentsEnabled, false);
    const serialized = JSON.stringify({
      configured: misplaced.configured,
      canCollect: misplaced.canCollect,
      invalidKeyType: misplaced.invalidKeyType,
      mode: misplaced.mode,
    });
    assert.equal(/pk_test_|sk_test_|whsec_/.test(serialized), false);
  });
});

test("swapped or mismatched Stripe key types keep checkout uncollectable", () => {
  withStripeEnv({
    [STRIPE_ENV_NAMES.secret]: "sk_test_example",
    [STRIPE_ENV_NAMES.publishable]: "sk_test_misplaced_secret",
    [STRIPE_ENV_NAMES.webhook]: "whsec_example",
  }, () => {
    const swapped = getStripeConfig();
    assert.equal(swapped.invalidKeyType, true);
    assert.equal(swapped.canCollect, false);
    assert.equal(swapped.configured, false);
  });
  withStripeEnv({
    [STRIPE_ENV_NAMES.secret]: "sk_test_example",
    [STRIPE_ENV_NAMES.publishable]: "pk_live_example",
    [STRIPE_ENV_NAMES.webhook]: "whsec_example",
  }, () => {
    const mismatched = getStripeConfig();
    assert.equal(mismatched.invalidKeyType, false);
    assert.equal(mismatched.modeMismatch, true);
    assert.equal(mismatched.canCollect, false);
    assert.equal(mismatched.configured, false);
    assert.equal(mismatched.mode, null);
  });
});
