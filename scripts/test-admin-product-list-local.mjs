import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import ts from "typescript";

function load(file) {
  const exports = {};
  const require = (id) => {
    if (id.startsWith("@/")) return load(id.slice(2) + ".ts");
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

const {
  categoryNameFromId,
  matchesAdminCategoryFilter,
  canonicalCategoryTabCounts,
  adminProductsHref,
} = load("src/lib/catalog/admin-product-list.ts");

const categories = [
  { id: "c-cos", name: "Cosmetics", slug: "cosmetics" },
  { id: "c-food", name: "Foods", slug: "foods" },
  { id: "c-mkt", name: "Ivoire Market", slug: "ivoire-market" },
];

let n = 0;
function test(name, fn) {
  fn();
  n++;
  console.log("PASS " + name);
}

test("badge uses the matching category id, never another row", () => {
  assert.equal(categoryNameFromId("c-cos", categories), "Cosmetics");
  assert.equal(categoryNameFromId("c-food", categories), "Foods");
  assert.equal(categoryNameFromId("c-mkt", categories), "Ivoire Market");
  assert.equal(categoryNameFromId("missing", categories), "Uncategorized");
  assert.equal(categoryNameFromId(null, categories), "Uncategorized");
});

test("cosmetics id is not shown as Ivoire Market", () => {
  const cosmeticsBadge = categoryNameFromId("c-cos", categories);
  assert.equal(cosmeticsBadge, "Cosmetics");
  assert.notEqual(cosmeticsBadge, "Ivoire Market");
});

test("category filter accepts slug or id and does not leak", () => {
  assert.equal(matchesAdminCategoryFilter("cosmetics", { categoryId: "c-cos" }, categories), true);
  assert.equal(matchesAdminCategoryFilter("c-cos", { categoryId: "c-cos" }, categories), true);
  assert.equal(matchesAdminCategoryFilter("ivoire-market", { categoryId: "c-cos" }, categories), false);
  assert.equal(matchesAdminCategoryFilter("cosmetics", { categoryId: "c-mkt" }, categories), false);
  assert.equal(matchesAdminCategoryFilter("all", { categoryId: "c-mkt" }, categories), true);
});

test("tab counts match canonical categories", () => {
  const counts = canonicalCategoryTabCounts(
    [
      { categoryId: "c-cos" },
      { categoryId: "c-cos" },
      { categoryId: "c-food" },
      { categoryId: "c-mkt" },
    ],
    categories,
  );
  assert.equal(counts.all, 4);
  assert.equal(counts.cosmetics, 2);
  assert.equal(counts.foods, 1);
  assert.equal(counts["ivoire-market"], 1);
});

test("category tabs keep status filters", () => {
  assert.equal(
    adminProductsHref({ category: "cosmetics", status: "draft" }),
    "/admin/products?status=draft&category=cosmetics",
  );
  assert.equal(
    adminProductsHref({ category: "ivoire-market", inventory: "needs_pricing" }),
    "/admin/products?inventory=needs_pricing&category=ivoire-market",
  );
  assert.equal(adminProductsHref({ category: "all" }), "/admin/products");
});

test("Refresh stays on the current products view instead of clearing filters", () => {
  const list = fs.readFileSync("app/admin/products/page.tsx", "utf8");
  const button = fs.readFileSync("src/components/admin/admin-products-refresh-button.tsx", "utf8");
  const actions = fs.readFileSync("src/lib/catalog/admin-actions.ts", "utf8");
  assert.match(list, /AdminProductsRefreshButton/);
  assert.doesNotMatch(list, /href="\/admin\/products"[\s\S]{0,80}Refresh/);
  assert.match(button, /router\.refresh\(\)/);
  assert.doesNotMatch(button, /window\.location/);
  assert.doesNotMatch(button, /router\.(push|replace)\(/);
  assert.match(button, /Refreshing\.\.\./);
  assert.match(button, /Couldn\\u2019t refresh products\. Try again\./);
  assert.match(button, /disabled=\{refreshing\}/);
  assert.match(actions, /revalidatePath\("\/admin\/products"\)/);
  assert.match(actions, /export async function refreshAdminProductsList/);
});

console.log(`${n} admin product list tests passed.`);
