import assert from "node:assert/strict";
import test from "node:test";
import {
  CANONICAL_PRODUCTION_ORIGIN,
  getAuthCallbackUrl,
  resolvePublicSiteUrl,
} from "./site.ts";

test("founder production origin is ivoireshop-steel, not ivoire-shop-five", () => {
  assert.equal(CANONICAL_PRODUCTION_ORIGIN, "https://ivoireshop-steel.vercel.app");
  assert.doesNotMatch(CANONICAL_PRODUCTION_ORIGIN, /ivoire-shop-five/);
});

test("preview site URL stays on the Preview deployment origin", () => {
  const preview = "https://ivoireshop-g4e701rlj-ivoireshop1.vercel.app";
  assert.equal(
    resolvePublicSiteUrl({ VERCEL_ENV: "preview" }, preview),
    preview,
  );
  assert.equal(
    resolvePublicSiteUrl({ VERCEL_ENV: "preview", VERCEL_URL: "ivoireshop-g4e701rlj-ivoireshop1.vercel.app" }),
    preview,
  );
});

test("production site URL uses the founder storefront", () => {
  assert.equal(
    resolvePublicSiteUrl({ VERCEL_ENV: "production" }, "https://ivoireshop-random.vercel.app"),
    CANONICAL_PRODUCTION_ORIGIN,
  );
});

test("auth callback on preview does not target production", () => {
  const previous = process.env.VERCEL_ENV;
  process.env.VERCEL_ENV = "preview";
  process.env.VERCEL_URL = "ivoireshop-g4e701rlj-ivoireshop1.vercel.app";
  try {
    const url = getAuthCallbackUrl("/account");
    assert.match(url, /ivoireshop-g4e701rlj-ivoireshop1\.vercel\.app\/auth\/callback/);
    assert.doesNotMatch(url, /ivoire-shop-five|ivoireshop-steel/);
  } finally {
    if (previous === undefined) delete process.env.VERCEL_ENV;
    else process.env.VERCEL_ENV = previous;
    delete process.env.VERCEL_URL;
  }
});
