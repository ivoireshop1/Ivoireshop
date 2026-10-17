import assert from "node:assert/strict";
import { test } from "node:test";
import { PRODUCT_SHOP_EMBEDS } from "./product-embeds.ts";

test("shop product embeds name both category foreign keys", () => {
  assert.match(PRODUCT_SHOP_EMBEDS, /products_category_id_fkey/);
  assert.match(PRODUCT_SHOP_EMBEDS, /products_subcategory_id_fkey/);
});
