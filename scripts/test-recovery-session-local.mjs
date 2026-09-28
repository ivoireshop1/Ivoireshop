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
    { exports, require },
    { filename: file },
  );
  return exports;
}

const { canSetRecoveryPassword, applyNewPasswordAndRevokeSession } = load("src/lib/auth/recovery-session.ts");
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

await test("password validation rejects the old-style short secret without logging it", () => {
  const result = validatePasswordChange({ nextPassword: "short", confirmPassword: "short" });
  assert.equal(result.ok, false);
});

console.log(`${n} recovery session tests passed.`);
