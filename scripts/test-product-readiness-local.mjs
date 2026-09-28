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
    { exports, require, URL },
    { filename: file },
  );
  return exports;
}

const { productMissingRequirements, productNeedsReview, productReadyToPublish } = load("src/lib/catalog/product-readiness.ts");
let n = 0;
function test(name, fn) {
  fn();
  n++;
  console.log("PASS " + name);
}

const complete = {
  name: "Shea butter",
  categoryId: "cat",
  price: 12.5,
  stockQuantity: 8,
  isActive: false,
  imageUrl: "https://example.test/a.jpg",
};

test("complete draft is ready to publish", () => {
  assert.equal(productMissingRequirements(complete).join(","), "");
  assert.equal(productReadyToPublish(complete), true);
  assert.equal(productNeedsReview(complete), true);
});

test("active complete product does not need review", () => {
  assert.equal(productNeedsReview({ ...complete, isActive: true }), false);
});

test("missing price is not ready", () => {
  assert.ok(productMissingRequirements({ ...complete, price: null }).includes("Price"));
  assert.equal(productReadyToPublish({ ...complete, price: 0 }), false);
});

test("zero inventory is allowed once present", () => {
  assert.equal(productMissingRequirements({ ...complete, stockQuantity: 0 }).join(","), "");
});

test("missing inventory is not ready", () => {
  assert.ok(productMissingRequirements({ ...complete, stockQuantity: null }).includes("Inventory"));
});

test("blob urls are not images", () => {
  assert.ok(productMissingRequirements({ ...complete, imageUrl: "blob:https://x/1" }).includes("Image"));
});

console.log(`${n} product readiness tests passed`);
