"use client";

import { useState } from "react";
import type { Product } from "@/src/types/catalog";
import { useCart } from "@/src/lib/cart/cart-context";
import { QuantitySelector } from "./quantity-selector";

export function AddToCart({ product }: { product: Product }) {
  const { addItem } = useCart();
  const [quantity, setQuantity] = useState(1);
  const [added, setAdded] = useState(false);
  function add() { addItem({ productId: product.id, slug: product.slug, name: product.name, price: product.price, image: product.image, quantity }); setAdded(true); setTimeout(() => setAdded(false), 1400); }
  return <div className="flex flex-wrap items-center gap-4"><QuantitySelector value={quantity} onChange={setQuantity} /><button className="rounded-lg bg-forest-green px-7 py-3 font-semibold text-white hover:bg-forest-green/90" onClick={add} type="button">{added ? "Added to cart" : "Add to cart"}</button></div>;
}
