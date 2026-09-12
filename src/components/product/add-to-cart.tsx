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
  const [isAdding, setIsAdding] = useState(false);
  const cartItem = items.find((item) => item.productId === product.id);

  function add() {
    setIsAdding(true);
    addItem({
      productId: product.id,
      slug: product.slug,
      name: product.name,
      price: product.price,
      image: product.image,
      quantity,
    });

    window.setTimeout(() => {
      setIsAdding(false);
      setAdded(true);
      window.setTimeout(() => setAdded(false), 1800);
    }, 150);
  }

  const cartQuantity = cartItem?.quantity ?? 0;

  return (
    <div className="flex flex-wrap items-center gap-4">
      <QuantitySelector value={quantity} onChange={setQuantity} />

      {cartItem ? (
        <div className="flex items-center gap-2 rounded-lg border border-forest-green/20 bg-[#f5f0e6] px-4 py-3 text-sm font-semibold text-forest-green">
          <span aria-hidden="true">✓</span>
          <span>{cartQuantity} already in cart</span>
        </div>
      ) : null}

      <button
        aria-label={isAdding ? `Adding ${quantity} ${product.name} to cart` : `Add ${quantity} ${product.name} to cart`}
        className="rounded-lg bg-forest-green px-7 py-3 font-semibold text-white transition hover:bg-forest-green/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-forest-green/60 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-70"
        disabled={isAdding}
        onClick={add}
        type="button"
      >
        {isAdding ? "Adding…" : added ? "✓ Added to cart" : "Add to cart"}
      </button>

      {cartItem && (
        <div className="w-full rounded-xl bg-[#f5f0e6] p-4 text-sm">
          <p className="font-semibold text-forest-green">Already in cart: {cartItem.quantity}</p>
          <div className="mt-3 flex flex-wrap gap-4 font-semibold">
            <Link className="text-forest-green underline underline-offset-4" href="/cart">
              View cart
            </Link>
            <button className="text-forest-green underline underline-offset-4" onClick={add} type="button">
              Add more
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
