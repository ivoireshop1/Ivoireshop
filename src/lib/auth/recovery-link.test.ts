import assert from "node:assert/strict";
import test from "node:test";
import { recoveryContinueHtml, recoveryCredential } from "./recovery-link.ts";

test("recovery credentials stay a single token", () => {
  assert.equal(recoveryCredential("abc_def-1234"), "abc_def-1234");
  assert.equal(recoveryCredential("short"), "");
  assert.equal(recoveryCredential("has space token"), "");
  assert.equal(recoveryCredential("<script>"), "");
});

test("continue page posts the token and does not redeem it on its own", () => {
  const html = recoveryContinueHtml({ tokenHash: "abcdefghijklmnop" });
  assert.match(html, /method="post"/);
  assert.match(html, /name="token_hash" value="abcdefghijklmnop"/);
  assert.doesNotMatch(html, /verifyOtp|exchangeCodeForSession|<script/i);
});

test("continue page escapes a credential that is still allowed", () => {
  const html = recoveryContinueHtml({ code: "abcd_efgh" });
  assert.match(html, /name="code" value="abcd_efgh"/);
  assert.doesNotMatch(html, /token_hash/);
});
