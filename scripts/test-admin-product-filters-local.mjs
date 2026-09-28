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
    { exports, require, URL },
    { filename: file },
  );
  return exports;
}

const { matchesAdminReviewFilter } = load("src/lib/catalog/admin-product-filters.ts");

const tracked = {
  name: "Rice",
  categoryId: "c1",
  categoryName: "Foods",
  price: 12,
  stockQuantity: null,
  trackInventory: true,
  isActive: false,
  imageUrl: "https://example.test/a.jpg",
};

const untracked = { ...tracked, trackInventory: false };

let n = 0;
function test(name, fn) {
  fn();
  n++;
  console.log("PASS " + name);
}

test("inventory issue requires tracking", () => {
  assert.equal(matchesAdminReviewFilter("inventory", tracked), true);
  assert.equal(matchesAdminReviewFilter("inventory", untracked), false);
});

test("untracked missing quantity is not an inventory issue", () => {
  assert.equal(matchesAdminReviewFilter("inventory", { ...untracked, stockQuantity: null }), false);
});

console.log(`${n} admin product filter tests passed.`);
