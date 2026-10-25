import assert from "node:assert/strict";
import test from "node:test";
import { stripeBrowserOptions } from "./stripe-client.ts";

test("Stripe.js testing assistant stays off without changing payment collection", () => {
  const options = stripeBrowserOptions();
  assert.equal(options.developerTools?.assistant?.enabled, false);
  assert.equal("clientSecret" in options, false);
  assert.equal("apiVersion" in options, false);
});
