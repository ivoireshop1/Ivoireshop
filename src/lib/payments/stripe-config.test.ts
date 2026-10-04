import assert from "node:assert/strict";
import { test } from "node:test";
import { getStripeConfig, STRIPE_ENV_NAMES } from "./stripe-config.ts";

test("stripe diagnostics never require a client-supplied amount and list missing env names", () => {
  const previous = {
    secret: process.env[STRIPE_ENV_NAMES.secret],
    publishable: process.env[STRIPE_ENV_NAMES.publishable],
    webhook: process.env[STRIPE_ENV_NAMES.webhook],
  };
  delete process.env[STRIPE_ENV_NAMES.secret];
  delete process.env[STRIPE_ENV_NAMES.publishable];
  delete process.env[STRIPE_ENV_NAMES.webhook];
  const empty = getStripeConfig();
  assert.equal(empty.canCollect, false);
  assert.equal(empty.configured, false);
  assert.deepEqual(empty.missingNames, [STRIPE_ENV_NAMES.publishable, STRIPE_ENV_NAMES.secret, STRIPE_ENV_NAMES.webhook]);
  process.env[STRIPE_ENV_NAMES.secret] = "sk_test_example";
  process.env[STRIPE_ENV_NAMES.publishable] = "pk_test_example";
  const collectable = getStripeConfig();
  assert.equal(collectable.canCollect, true);
  assert.equal(collectable.configured, false);
  assert.equal(collectable.mode, "test");
  assert.deepEqual(collectable.missingNames, [STRIPE_ENV_NAMES.webhook]);
  process.env[STRIPE_ENV_NAMES.webhook] = "whsec_example";
  const full = getStripeConfig();
  assert.equal(full.configured, true);
  assert.equal(full.missingNames.length, 0);
  if (previous.secret) process.env[STRIPE_ENV_NAMES.secret] = previous.secret;
  else delete process.env[STRIPE_ENV_NAMES.secret];
  if (previous.publishable) process.env[STRIPE_ENV_NAMES.publishable] = previous.publishable;
  else delete process.env[STRIPE_ENV_NAMES.publishable];
  if (previous.webhook) process.env[STRIPE_ENV_NAMES.webhook] = previous.webhook;
  else delete process.env[STRIPE_ENV_NAMES.webhook];
});
