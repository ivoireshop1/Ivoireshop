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
    ts.transpileModule(fs.readFileSync(file, "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText,
    { exports, require, URL, process: { env: {} } },
    { filename: file },
  );
  return exports;
}

const { resolvePublicSiteUrl } = load("src/lib/site.ts");
const { isPasswordRecoveryPath } = load("src/lib/auth/recovery.ts");
const { isSafeStorefrontPath, safeStorefrontPath } = load("src/lib/storefront/cta.ts", {
  "@/src/lib/navigation/smart-navigation": load("src/lib/navigation/smart-navigation.ts"),
});
const { isPublicNewArrival, isPublicComingSoon, isPurchasableCatalogProduct } = load("src/lib/catalog/merchandising.ts");
let n = 0;
function test(name, fn) { fn(); n++; console.log("PASS " + name); }

test("production recovery host is used when local SITE_URL is set", () => {
  assert.equal(
    resolvePublicSiteUrl(
      {
        NEXT_PUBLIC_SITE_URL: "http://localhost:3000",
        VERCEL_ENV: "production",
        VERCEL_PROJECT_PRODUCTION_URL: "ivoire-shop-five.vercel.app",
      },
    ),
    "https://ivoire-shop-five.vercel.app",
  );
  assert.equal(
    resolvePublicSiteUrl({ NEXT_PUBLIC_SITE_URL: "http://localhost:3000" }, "https://ivoire-shop-five.vercel.app"),
    "https://ivoire-shop-five.vercel.app",
  );
});

test("Vercel deployment and team alias origins are never used for customer auth", () => {
  assert.equal(
    resolvePublicSiteUrl(
      {
        NEXT_PUBLIC_SITE_URL: "https://ivoire-shop-five.vercel.app",
        VERCEL_ENV: "production",
        VERCEL_URL: "ivoire-shop-kcedntz9m-ibrahim-s-projects-1a340afc.vercel.app",
      },
      "https://ivoire-shop-kcedntz9m-ibrahim-s-projects-1a340afc.vercel.app",
    ),
    "https://ivoire-shop-five.vercel.app",
  );
  assert.equal(
    resolvePublicSiteUrl({
      VERCEL_ENV: "production",
      VERCEL_PROJECT_PRODUCTION_URL: "ivoire-shop-ibrahim-s-projects-1a340afc.vercel.app",
    }),
    "https://ivoire-shop-five.vercel.app",
  );
  assert.equal(
    resolvePublicSiteUrl({ VERCEL_ENV: "preview", VERCEL_URL: "ivoire-shop-git-auth-xxx.vercel.app" }),
    "https://ivoire-shop-five.vercel.app",
  );
});

test("local development still uses localhost", () => {
  assert.equal(
    resolvePublicSiteUrl({ NEXT_PUBLIC_SITE_URL: "http://localhost:3000", NODE_ENV: "development" }),
    "http://localhost:3000",
  );
});

test("recovery destinations are recognized", () => {
  assert.equal(isPasswordRecoveryPath("/reset-password"), true);
  assert.equal(isPasswordRecoveryPath("/update-password"), true);
  assert.equal(isPasswordRecoveryPath("/admin"), false);
});

test("unsafe billboard destinations rejected", () => {
  assert.equal(isSafeStorefrontPath("javascript:alert(1)"), false);
  assert.equal(isSafeStorefrontPath("https://evil.test"), false);
  assert.equal(isSafeStorefrontPath("//evil.test"), false);
  assert.equal(isSafeStorefrontPath("/shop?arrival=new"), true);
  assert.equal(safeStorefrontPath("javascript:alert(1)"), "/shop");
});

const complete = { name: "Rice", categoryId: "c", price: 12, isActive: true, isNewArrival: true, imageUrl: "https://example.test/a.jpg" };
test("draft new arrival stays private", () => {
  assert.equal(isPublicNewArrival({ ...complete, isActive: false }), false);
});
test("active new arrival is public", () => {
  assert.equal(isPublicNewArrival(complete), true);
});
test("coming soon is preview-only and not purchasable", () => {
  const soon = { ...complete, isActive: false, isComingSoon: true, isNewArrival: false };
  assert.equal(isPublicComingSoon(soon), true);
  assert.equal(isPurchasableCatalogProduct(soon), false);
});
test("coming soon without image stays private", () => {
  assert.equal(isPublicComingSoon({ name: "Soon", categoryId: "c", isActive: false, isComingSoon: true, imageUrl: "blob:https://x/1" }), false);
});

console.log(`${n} merchandising and recovery helper tests passed`);
