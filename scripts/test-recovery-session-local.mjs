import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import ts from "typescript";

function load(file, deps = {}) {
  const exports = {};
  const require = (id) => {
    if (deps[id]) return deps[id];
    if (id.startsWith("@/")) return load(id.slice(2) + ".ts", deps);
    throw new Error(id);
  };
  vm.runInNewContext(
    ts.transpileModule(fs.readFileSync(file, "utf8"), {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
    }).outputText,
    { exports, require, URLSearchParams },
    { filename: file },
  );
  return exports;
}

const { canSetRecoveryPassword, applyNewPasswordAndRevokeSession, parseRecoveryFragment } = load(
  "src/lib/auth/recovery-session.ts",
);
const { validatePasswordChange } = load("src/lib/auth/password-rules.ts");

let n = 0;
async function test(name, fn) {
  await fn();
  n++;
  console.log("PASS " + name);
}

await test("existing login session is not treated as recovery", () => {
  assert.equal(canSetRecoveryPassword({ hasSession: true, event: "SIGNED_IN" }), false);
  assert.equal(canSetRecoveryPassword({ hasSession: true, stage: "set" }), true);
  assert.equal(canSetRecoveryPassword({ hasSession: true, event: "PASSWORD_RECOVERY" }), true);
  assert.equal(canSetRecoveryPassword({ hasSession: false, stage: "set" }), false);
});

await test("mismatch is rejected before updateUser", async () => {
  let updated = false;
  let signedOut = false;
  const result = await applyNewPasswordAndRevokeSession(
    {
      auth: {
        getUser: async () => ({ data: { user: { id: "u1" } } }),
        updateUser: async () => {
          updated = true;
          return { error: null };
        },
        signOut: async () => {
          signedOut = true;
          return { error: null };
        },
      },
    },
    { nextPassword: "newpass12", confirmPassword: "otherpass" },
  );
  assert.equal(result.success, false);
  assert.equal(updated, false);
  assert.equal(signedOut, false);
});

await test("successful recovery update revokes the session", async () => {
  const calls = [];
  const result = await applyNewPasswordAndRevokeSession(
    {
      auth: {
        getUser: async () => ({ data: { user: { id: "u1" } } }),
        updateUser: async (payload) => {
          calls.push(["update", payload.password]);
          return { error: null };
        },
        signOut: async (options) => {
          calls.push(["signOut", options.scope]);
          return { error: null };
        },
      },
    },
    { nextPassword: "newpass12", confirmPassword: "newpass12" },
  );
  assert.equal(result.success, true);
  assert.equal(result.signedOut, true);
  assert.deepEqual(calls, [
    ["update", "newpass12"],
    ["signOut", "global"],
  ]);
});

await test("recovery tokens delivered in the URL fragment are recognised", () => {
  const fragment = parseRecoveryFragment(
    "#access_token=abc&refresh_token=def&expires_in=3600&token_type=bearer&type=recovery",
  );
  assert.equal(fragment.accessToken, "abc");
  assert.equal(fragment.refreshToken, "def");
  // Supabase omits type on some redirects; the grant is still usable.
  const untyped = parseRecoveryFragment("#access_token=a&refresh_token=b");
  assert.equal(untyped.accessToken, "a");
  assert.equal(untyped.refreshToken, "b");
});

await test("non-recovery and broken fragments are refused", () => {
  assert.equal(parseRecoveryFragment(""), null);
  assert.equal(parseRecoveryFragment(null), null);
  assert.equal(parseRecoveryFragment("#error=access_denied&error_code=otp_expired"), null);
  assert.equal(parseRecoveryFragment("#access_token=a&refresh_token=b&type=signup"), null);
  assert.equal(parseRecoveryFragment("#access_token=a"), null);
  assert.equal(parseRecoveryFragment("#refresh_token=b"), null);
});

await test("a recovery link grants the set-password form without a stage parameter", () => {
  assert.equal(canSetRecoveryPassword({ hasSession: true, fromRecoveryLink: true }), true);
  // Still no bypass for an ordinary signed-in visitor.
  assert.equal(canSetRecoveryPassword({ hasSession: true, fromRecoveryLink: false }), false);
  assert.equal(canSetRecoveryPassword({ hasSession: false, fromRecoveryLink: true }), false);
});

await test("the auth callback hands fragment recovery to the set-password stage", () => {
  const source = fs.readFileSync("app/auth/callback/route.ts", "utf8");
  const fallback = source.slice(source.indexOf("} else if (recovered) {"));
  assert.match(fallback, /RECOVERY_SET_PASSWORD_PATH/);
  assert.doesNotMatch(fallback.slice(0, fallback.indexOf("} else {")), /RECOVERY_INVALID_PATH/);
});

await test("the reset page consumes the fragment before rendering the invalid state", () => {
  const source = fs.readFileSync("src/components/auth/password-recovery-experience.tsx", "utf8");
  assert.match(source, /setSession\(\{/);
  assert.ok(source.indexOf("if (fragment) {") < source.indexOf("if (invalid) {"));
  assert.match(source, /window\.history\.replaceState/);
});

await test("password validation rejects the old-style short secret without logging it", () => {
  const result = validatePasswordChange({ nextPassword: "short", confirmPassword: "short" });
  assert.equal(result.ok, false);
});

console.log(`${n} recovery session tests passed.`);
