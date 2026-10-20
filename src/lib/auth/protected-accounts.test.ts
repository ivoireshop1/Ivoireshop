import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  assertNotProtectedProductionIdentity,
  isProtectedAuthEmail,
  isProtectedAuthUserId,
} from "./protected-accounts.ts";

describe("protected Production admin identities", () => {
  it("protects the Steel admin mailbox and id", () => {
    assert.equal(isProtectedAuthEmail("ivoireshop37@gmail.com"), true);
    assert.equal(isProtectedAuthEmail("IVOIRESHOP37@GMAIL.COM"), true);
    assert.equal(isProtectedAuthUserId("af99b9a1-ccd4-4c1c-b63c-836691e3002d"), true);
    assert.equal(isProtectedAuthEmail("qa-demo@example.com"), false);
  });

  it("refuses admin role, protected email, and protected id", () => {
    assert.throws(
      () => assertNotProtectedProductionIdentity({ role: "admin", email: "customer@example.com" }),
      /admin role/,
    );
    assert.throws(
      () => assertNotProtectedProductionIdentity({ email: "ivoireshop37@gmail.com" }),
      /admin mailbox/,
    );
    assert.throws(
      () => assertNotProtectedProductionIdentity({ id: "af99b9a1-ccd4-4c1c-b63c-836691e3002d" }),
      /admin user id/,
    );
  });
});
