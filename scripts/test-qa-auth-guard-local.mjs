import assert from "node:assert/strict";
import {
  assertIdScopedStatement,
  assertTemporaryQaUser,
  isQaEmail,
} from "./qa-auth-guard.mjs";

const qaId = "486e3a83-f6a7-4022-b40a-cd7f7312bda8";
const ownerId = "af99b9a1-0000-4000-8000-000000000000";
const created = new Set([qaId]);

let n = 0;
function test(name, fn) {
  fn();
  n++;
  console.log("PASS " + name);
}

test("temporary QA customer this run created is allowed", () => {
  const id = assertTemporaryQaUser(
    { id: qaId, email: "qa-03f6b5407345@example.com", role: "customer" },
    created,
  );
  assert.equal(id, qaId);
});

test("an admin profile is refused even with a QA email", () => {
  assert.throws(
    () => assertTemporaryQaUser({ id: qaId, email: "qa-x@example.com", role: "admin" }, created),
    /profile role is admin/,
  );
});

test("the real owner account is refused", () => {
  assert.throws(
    () => assertTemporaryQaUser({ id: ownerId, email: "owner@gmail.com", role: "admin" }, created),
    /profile role is admin/,
  );
});

test("a non-QA email is refused even when the role is customer", () => {
  assert.throws(
    () => assertTemporaryQaUser({ id: ownerId, email: "real.person@gmail.com", role: "customer" }, created),
    /outside the QA email pattern/,
  );
});

test("an id this run did not create is refused", () => {
  assert.throws(
    () => assertTemporaryQaUser({ id: ownerId, email: "qa-other@example.com", role: "customer" }, created),
    /did not create/,
  );
});

test("a missing or non-uuid id is refused", () => {
  assert.throws(() => assertTemporaryQaUser({ email: "qa-x@example.com", role: "customer" }, created), /immutable auth user id/);
  assert.throws(() => assertTemporaryQaUser({ id: "qa-user", email: "qa-x@example.com", role: "customer" }, created), /immutable auth user id/);
});

test("QA email pattern does not match real mailboxes", () => {
  assert.equal(isQaEmail("qa-abc123@example.com"), true);
  assert.equal(isQaEmail("qa-abc123@example.invalid"), true);
  assert.equal(isQaEmail("owner@gmail.com"), false);
  assert.equal(isQaEmail("qa-abc@gmail.com"), false);
});

test("email-pattern deletes against auth.users are refused", () => {
  assert.throws(
    () => assertIdScopedStatement("delete from auth.users where email like 'qa-%@example.com'"),
    /must not select users by email pattern/,
  );
  assert.throws(
    () => assertIdScopedStatement("delete from auth.users"),
    /parameterized id predicate/,
  );
  assert.equal(
    assertIdScopedStatement("delete from auth.users where id = $1"),
    "delete from auth.users where id = $1",
  );
});

console.log(`${n} QA auth guard tests passed.`);
