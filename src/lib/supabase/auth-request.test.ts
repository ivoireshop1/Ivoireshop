import assert from "node:assert/strict";
import test from "node:test";
import {
  hasSupabaseSessionCookie,
  headerRoleSync,
  readBrowserSupabaseSessionCookie,
  requestHasPrefetchHeader,
  shellAuthRequestCount,
  shouldRefreshSupabaseSession,
} from "./auth-request.ts";

const session = [{ name: "sb-lidqskyavlkzwerpncxa-auth-token.0", value: "chunk" }];

test("guest documents and prefetches skip Auth refresh", () => {
  assert.equal(hasSupabaseSessionCookie([]), false);
  assert.equal(hasSupabaseSessionCookie([{ name: "sb-ref-auth-token-code-verifier", value: "pkce" }]), false);
  assert.equal(shouldRefreshSupabaseSession({ cookies: [], headers: new Headers() }), false);
  assert.equal(shouldRefreshSupabaseSession({
    cookies: session,
    headers: new Headers({ "next-router-prefetch": "1" }),
  }), false);
  assert.equal(shouldRefreshSupabaseSession({
    cookies: session,
    headers: new Headers({ purpose: "prefetch" }),
  }), false);
  assert.equal(shouldRefreshSupabaseSession({ cookies: session, headers: new Headers() }), true);
});

test("prefetch header detection stays limited to prefetch signals", () => {
  assert.equal(requestHasPrefetchHeader(new Headers({ "sec-purpose": "prefetch" })), true);
  assert.equal(requestHasPrefetchHeader(new Headers({ purpose: "navigation" })), false);
  assert.equal(readBrowserSupabaseSessionCookie("theme=light; sb-ref-auth-token=present"), true);
  assert.equal(readBrowserSupabaseSessionCookie("theme=light"), false);
});

test("header role changes do not call Auth for guests or token refresh", () => {
  assert.equal(headerRoleSync("INITIAL_SESSION", false), "keep");
  assert.equal(headerRoleSync("SIGNED_OUT", false), "guest");
  assert.equal(headerRoleSync("INITIAL_SESSION", true), "profile");
  assert.equal(headerRoleSync("TOKEN_REFRESHED", true), "keep");
  assert.equal(headerRoleSync("SIGNED_IN", true), "profile");
});

test("shell Auth counts drop for guests and prefetches and keep signed-in refresh", () => {
  assert.equal(shellAuthRequestCount({ kind: "document", signedIn: false, optimized: false }), 4);
  assert.equal(shellAuthRequestCount({ kind: "document", signedIn: false, optimized: true }), 0);
  assert.equal(shellAuthRequestCount({ kind: "prefetch", signedIn: false, optimized: false }), 1);
  assert.equal(shellAuthRequestCount({ kind: "prefetch", signedIn: true, optimized: true }), 0);
  assert.equal(shellAuthRequestCount({ kind: "document", signedIn: true, optimized: true }), 2);
  assert.equal(shellAuthRequestCount({ kind: "document", signedIn: true, optimized: false }), 4);
});
