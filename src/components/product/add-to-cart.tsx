"use client";

import { useState } from "react";
import Link from "next/link";
import type { Product } from "@/src/types/catalog";
import { useCart } from "@/src/lib/cart/cart-context";
import { QuantitySelector } from "./quantity-selector";

export function AddToCart({ product }: { product: Product }) {
  const { addItem, items } = useCart();
  const [quantity, setQuantity] = useState(1);
  const [added, setAdded] = useState(false);
  const cartItem = items.find((item) => item.productId === product.id);
  function add() { addItem({ productId: product.id, slug: product.slug, name: product.name, price: product.price, image: product.image, quantity }); setAdded(true); setTimeout(() => setAdded(false), 2000); }
  return <div className="flex flex-wrap items-center gap-4"><QuantitySelector value={quantity} onChange={setQuantity} />{cartItem ? <span className="rounded-lg border border-forest-green/20 px-7 py-3 font-semibold text-forest-green">{added ? "✓ Added to cart" : "✓ Already in cart"}</span> : <button aria-label={`Add ${quantity} ${product.name} to cart`} className="rounded-lg bg-forest-green px-7 py-3 font-semibold text-white transition hover:bg-forest-green/90" onClick={add} type="button">Add to cart</button>}{cartItem && <div className="w-full rounded-xl bg-[#f5f0e6] p-4 text-sm"><p className="font-semibold text-forest-green">Quantity in cart: {cartItem.quantity}</p><div className="mt-3 flex flex-wrap gap-4 font-semibold"><Link className="text-forest-green underline underline-offset-4" href="/cart">View cart</Link><button className="text-forest-green underline underline-offset-4" onClick={add} type="button">Add more</button></div></div>}</div>;
}
