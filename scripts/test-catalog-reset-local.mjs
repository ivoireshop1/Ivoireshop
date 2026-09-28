import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import ts from "typescript";

function load(file) {
  const exports = {};
  const require = (id) => {
    if (id.startsWith("@/")) {
      const resolved = id.slice(2);
      return load(resolved.endsWith(".ts") ? resolved : `${resolved}.ts`);
    }
    throw new Error(id);
  };
  vm.runInNewContext(
    ts.transpileModule(fs.readFileSync(file, "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText,
    { exports, require },
    { filename: file },
  );
  return exports;
}

const {
  UNLIST_CONFIRMATION,
  CLEAR_PRICES_CONFIRMATION,
  CLEAR_PRICES_PHRASE,
  FRESH_START_PHRASE,
  RESTORE_PHRASE,
  FRESH_RESET_SUCCESS,
  CATALOG_PREPARING_TITLE,
  CATALOG_PREPARING_BODY,
  parseCatalogImpact,
  formatCatalogImpact,
  confirmationMatches,
  isBulkActivateEligible,
  bulkPriceConfirmation,
} = load("src/lib/catalog/catalog-reset.ts");
const { draftsReadyForActivation } = load("src/lib/catalog/pricing-input.ts");
const sql = fs.readFileSync("supabase/migrations/20260928174932_catalog_reset_controls.sql", "utf8");
const actions = fs.readFileSync("src/lib/catalog/catalog-reset-actions.ts", "utf8");
const panel = fs.readFileSync("src/components/admin/catalog-controls-panel.tsx", "utf8");
const manager = fs.readFileSync("src/components/admin/admin-products-manager.tsx", "utf8");
const shop = fs.readFileSync("src/components/product/shop-experience.tsx", "utf8");
const notice = fs.readFileSync("src/components/storefront/catalog-preparing-notice.tsx", "utf8");
const emptyHome = fs.readFileSync("src/components/storefront/catalog-empty-home.tsx", "utf8");
const productsPage = fs.readFileSync("app/admin/products/page.tsx", "utf8");
const shell = fs.readFileSync("src/components/admin/admin-shell.tsx", "utf8");
const row = fs.readFileSync("src/components/admin/admin-product-row.tsx", "utf8");
const form = fs.readFileSync("src/components/admin/catalog-form.tsx", "utf8");
const layout = fs.readFileSync("app/admin/layout.tsx", "utf8");

let n = 0;
function test(name, fn) {
  fn();
  n++;
  console.log("PASS " + name);
}

test("confirmation phrases match the owner safety copy", () => {
  assert.equal(UNLIST_CONFIRMATION, "Unlist every product from the customer store?");
  assert.equal(CLEAR_PRICES_CONFIRMATION, "Clear prices from all products?");
  assert.equal(CLEAR_PRICES_PHRASE, "CLEAR PRICES");
  assert.equal(FRESH_START_PHRASE, "FRESH START");
  assert.equal(RESTORE_PHRASE, "RESTORE");
  assert.equal(confirmationMatches(" CLEAR PRICES ", CLEAR_PRICES_PHRASE), true);
  assert.equal(confirmationMatches("clear prices", CLEAR_PRICES_PHRASE), false);
  assert.equal(confirmationMatches("FRESH START", FRESH_START_PHRASE), true);
});

test("impact counts are parsed from live RPC keys not hardcoded", () => {
  const impact = parseCatalogImpact({
    total: 578,
    active: 24,
    foods: 309,
    cosmetics: 100,
    ivoire_market: 169,
    with_prices: 400,
    inventory_tracked: 12,
  });
  assert.equal(impact.ivoireMarket, 169);
  assert.deepEqual(formatCatalogImpact(impact)[0], "578 total products");
  assert.equal(productsPage.includes("578"), false);
  assert.equal(panel.includes("578 total products"), false);
});

test("fresh reset success and empty store copy", () => {
  assert.equal(FRESH_RESET_SUCCESS, "Catalog reset complete. Products are organized and ready for pricing.");
  assert.equal(CATALOG_PREPARING_TITLE, "Products are being prepared.");
  assert.equal(CATALOG_PREPARING_BODY, "Please check back soon.");
  assert.match(productsPage, /success === "catalog_reset"/);
  assert.match(shop, /CatalogPreparingNotice/);
  assert.match(notice, /CATALOG_PREPARING_TITLE/);
  assert.match(emptyHome, /CatalogEmptyHome/);
});

test("untracked products do not need quantity to activate", () => {
  assert.equal(draftsReadyForActivation("12.50", "", false).ok, true);
  assert.equal(draftsReadyForActivation("12.50", "", true).ok, false);
  assert.equal(
    isBulkActivateEligible({
      name: "Shea Butter",
      hasCategory: true,
      hasImage: true,
      price: 12.5,
      stockQuantity: null,
      trackInventory: false,
    }),
    true,
  );
  assert.equal(
    isBulkActivateEligible({
      name: "Shea Butter",
      hasCategory: true,
      hasImage: true,
      price: 12.5,
      stockQuantity: null,
      trackInventory: true,
    }),
    false,
  );
  assert.equal(
    isBulkActivateEligible({
      name: "Shea Butter",
      hasCategory: true,
      hasImage: true,
      price: null,
      trackInventory: false,
    }),
    false,
  );
});

test("bulk price requires an explicit entered price", () => {
  assert.equal(bulkPriceConfirmation(3, "$9.99"), "Set price $9.99 on 3 selected products?");
  assert.match(manager, /bulkSetPriceAction/);
  assert.match(manager, /Select all visible/);
  assert.match(manager, /Activate eligible/);
  assert.match(manager, /window\.confirm\(bulkPriceConfirmation/);
});

test("admin-only page and RPC wrappers require admin", () => {
  assert.match(layout, /requireAdmin/);
  assert.match(actions, /requireAdmin/);
  assert.match(actions, /admin_unlist_all_products/);
  assert.match(actions, /admin_clear_all_prices/);
  assert.match(actions, /admin_fresh_catalog_reset/);
  assert.match(actions, /admin_restore_last_catalog_snapshot/);
  assert.match(actions, /redirect\("\/admin\/products\?status=draft&success=catalog_reset"\)/);
  assert.match(shell, /Catalog Controls/);
});

test("typed confirmation and second Reset Catalog button exist", () => {
  assert.match(panel, /UNLIST_CONFIRMATION/);
  assert.match(panel, /CLEAR_PRICES_PHRASE/);
  assert.match(panel, /FRESH_START_PHRASE/);
  assert.match(panel, /RESTORE_PHRASE/);
  assert.match(panel, /Reset Catalog/);
  assert.match(panel, /confirmationMatches\(phrase, FRESH_START_PHRASE\)/);
});

test("draft cards expose price, Save Draft, and Approve/Activate", () => {
  assert.match(row, /Save Draft/);
  assert.match(row, /Approve \/ Activate/);
  assert.match(form, /Save Draft/);
  assert.match(form, /Approve \/ Activate/);
});

test("migration is DDL only and never resets the live catalog", () => {
  assert.match(sql, /Does not update, unlist, or reprice existing catalog rows/);
  assert.equal(sql.includes("perform public.admin_fresh_catalog_reset"), false);
  assert.equal(sql.includes("select public.admin_fresh_catalog_reset"), false);
  assert.match(sql, /create table if not exists public.catalog_state_snapshots/);
  assert.match(sql, /price = null/);
  assert.match(sql, /track_inventory = false/);
  assert.match(sql, /revoke all on function public\._catalog_reset_apply/);
  assert.match(sql, /if not \(select public\.is_admin\(\)\)/);
  assert.match(sql, /qa-catalog-reset-%/);
  assert.equal(sql.includes("delete from public.products"), false);
  assert.equal(sql.includes("delete from public.orders"), false);
  assert.equal(sql.includes("delete from public.reviews"), false);
});

test("migration preserves identity fields", () => {
  assert.equal(sql.includes("p.name ="), false);
  assert.equal(sql.includes("p.slug ="), false);
  assert.equal(sql.includes("p.sku ="), false);
  assert.equal(sql.includes("sku = null"), false);
  assert.equal(sql.includes("category_id = null"), false);
  assert.match(sql, /category_id = coalesce/);
});

console.log(`${n} catalog-reset helper tests passed.`);
