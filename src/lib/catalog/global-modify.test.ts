import assert from "node:assert/strict";
import { test } from "node:test";
import { globalModifyPatch, previewGlobalModify } from "./global-modify.ts";

const products = [
  { id: "a", name: "Rice", category_id: "foods", subcategory_id: null, price: 4, stock_quantity: 2, is_active: true },
];
const categories = [
  { id: "foods", parent_id: null },
  { id: "sauces", parent_id: "foods" },
];

test("preview reports invalid subcategory and valid price patch", () => {
  const bad = previewGlobalModify(products, ["a"], { subcategory_id: "nope" }, categories);
  assert.equal(bad[0].error, "Subcategory must belong to the selected category.");
  const good = previewGlobalModify(products, ["a"], { price: "5.50", is_active: "inactive" }, categories);
  assert.equal(good[0].error, undefined);
  assert.deepEqual(globalModifyPatch({ price: "5.50", is_active: "inactive" }), { price: 5.5, is_active: false });
});
