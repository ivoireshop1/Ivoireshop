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
    ts.transpileModule(fs.readFileSync(file, "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText,
    { exports, require },
    { filename: file },
  );
  return exports;
}

const { toggleSelectedId, selectAllVisible, clearSelection, isVisibleSelectionComplete, bulkMoveConfirmation, isBulkTargetSlug } = load("src/lib/catalog/bulk-selection.ts");
const { isAssignableCategory } = load("src/lib/catalog/canonical-categories.ts");
const { classifyCatalogName } = load("src/lib/catalog/category-review.ts");
const { matchesAdminReviewFilter } = load("src/lib/catalog/admin-product-filters.ts");
const { remainingPurchasableQuantity, publicStockLabel } = load("src/lib/catalog/inventory.ts");
let n = 0;
function test(name, fn) { fn(); n++; console.log("PASS " + name); }

test("toggle and select all visible", () => {
  assert.equal(toggleSelectedId(["a"], "b").join(","), "a,b");
  assert.equal(toggleSelectedId(["a", "b"], "a").join(","), "b");
  assert.equal(selectAllVisible(["x", "y"]).join(","), "x,y");
  assert.equal(clearSelection().length, 0);
  assert.equal(isVisibleSelectionComplete(["x", "y"], ["x", "y"]), true);
});
test("bulk confirmation and canonical targets", () => {
  assert.equal(bulkMoveConfirmation(25, "Ivoire Market"), "Move 25 selected products to Ivoire Market?");
  assert.equal(isBulkTargetSlug("ivoire-market"), true);
  assert.equal(isBulkTargetSlug("rice-grains"), false);
});
test("inactive categories are not assignable except current", () => {
  assert.equal(isAssignableCategory({ id: "1", slug: "foods", is_active: true }), true);
  assert.equal(isAssignableCategory({ id: "2", slug: "rice-grains", is_active: false }), false);
  assert.equal(isAssignableCategory({ id: "2", slug: "rice-grains", is_active: false }, "2"), true);
});
test("obvious cookware is reported not auto-moved", () => {
  const result = classifyCatalogName("Aluminum Cooking Pot 5L", "Foods");
  assert.equal(result.recommended, "Ivoire Market");
  assert.equal(result.confidence, "obvious-market");
  assert.equal(result.current, "Foods");
});
test("ambiguous names stay in review", () => {
  assert.equal(classifyCatalogName("Mystery Item", "Foods").confidence, "keep");
  assert.equal(classifyCatalogName("Palm Oil", "Foods").confidence, "keep");
});
test("review filters", () => {
  const product = { name: "Pot", categoryId: "c", price: 10, stockQuantity: 1, trackInventory: true, needsCategoryReview: true, isActive: true, imageUrl: "https://x/a.jpg" };
  assert.equal(matchesAdminReviewFilter("category", product), true);
  assert.equal(matchesAdminReviewFilter("draft", product), false);
  assert.equal(matchesAdminReviewFilter("inventory", { ...product, stockQuantity: null }), true);
});
test("untracked remaining quantity is not zero", () => {
  assert.ok(remainingPurchasableQuantity(false, null, 0) > 0);
  assert.equal(publicStockLabel(false, null), "Inventory not tracked");
  assert.equal(remainingPurchasableQuantity(true, 0, 0), 0);
});
console.log(`${n} bulk/category/inventory helper tests passed.`);
