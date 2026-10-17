import assert from "node:assert/strict";
import { test } from "node:test";
import { childrenOf, rootCategories, shopMatchesCategory } from "./category-tree.ts";

const categories = [
  { id: "1", name: "Foods", slug: "foods", parent_id: null, sort_order: 1 },
  { id: "2", name: "Sauces", slug: "sauces", parent_id: "1", sort_order: 0 },
  { id: "3", name: "Cosmetics", slug: "cosmetics", parent_id: null, sort_order: 0 },
];

test("roots and children stay nested under top-level categories", () => {
  assert.deepEqual(rootCategories(categories).map((row) => row.slug), ["cosmetics", "foods"]);
  assert.deepEqual(childrenOf("1", categories).map((row) => row.slug), ["sauces"]);
});

test("shop defaults to all products and can filter by subcategory", () => {
  assert.equal(shopMatchesCategory({ selected: "All", categorySlug: "foods", subcategorySlug: "sauces" }), true);
  assert.equal(shopMatchesCategory({ selected: "sauces", categorySlug: "foods", subcategorySlug: "sauces" }), true);
  assert.equal(shopMatchesCategory({ selected: "cosmetics", categorySlug: "foods", subcategorySlug: "sauces" }), false);
});
