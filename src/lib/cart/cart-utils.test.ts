import assert from "node:assert/strict";
import { test } from "node:test";
import { mergeItem, subtractPurchasedItems } from "./cart-utils.ts";
import type { CartItem } from "../../types/cart.ts";

function item(partial: Partial<CartItem> & Pick<CartItem, "productId" | "name" | "quantity">): CartItem {
  return {
    slug: "rice",
    price: 8,
    image: "/rice.jpg",
    ...partial,
  };
}

test("cart lines with different weight options stay separate", () => {
  const first = mergeItem([], item({
    productId: "prod-1",
    name: "Rice · 2 lb",
    quantity: 1,
    weightOptionId: "opt-2",
    weightOptionLabel: "2 lb",
  }));
  const mixed = mergeItem(first, item({
    productId: "prod-1",
    name: "Rice · 5 lb",
    quantity: 1,
    price: 18,
    weightOptionId: "opt-5",
    weightOptionLabel: "5 lb",
  }));
  assert.equal(mixed.length, 2);
  const again = mergeItem(mixed, item({
    productId: "prod-1",
    name: "Rice · 2 lb",
    quantity: 2,
    weightOptionId: "opt-2",
    weightOptionLabel: "2 lb",
  }));
  assert.equal(again.length, 2);
  assert.equal(again.find((row) => row.weightOptionId === "opt-2")?.quantity, 3);
});

test("purchase completion subtracts only the selected weight option", () => {
  const remaining = subtractPurchasedItems([
    item({ productId: "prod-1", name: "Rice · 2 lb", quantity: 2, weightOptionId: "opt-2" }),
    item({ productId: "prod-1", name: "Rice · 5 lb", quantity: 1, weightOptionId: "opt-5" }),
  ], [{ productId: "prod-1", quantity: 1, weightOptionId: "opt-2" }]);
  assert.equal(remaining.length, 2);
  assert.equal(remaining.find((row) => row.weightOptionId === "opt-2")?.quantity, 1);
  assert.equal(remaining.find((row) => row.weightOptionId === "opt-5")?.quantity, 1);
});
