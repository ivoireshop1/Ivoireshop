"use client";

import { useState } from "react";
import Link from "next/link";
import { createClient } from "@/src/lib/supabase/browser";
import { useCart } from "@/src/lib/cart/cart-context";

type ProductRow = {
  id: string;
  name: string;
  slug: string;
  price: number | string;
  stock_quantity: number;
  is_active: boolean;
  product_images?: { image_url: string; position: number }[] | null;
};

type OrderItemRow = {
  product_id: string | null;
  quantity: number;
  products: ProductRow | ProductRow[] | null;
};

function nestedProduct(value: ProductRow | ProductRow[] | null) {
  if (!value) return null;
  return Array.isArray(value) ? value[0] ?? null : value;
}

export function ReorderButton({ orderId }: { orderId: string }) {
  const { addItem } = useCart();
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [addedToCart, setAddedToCart] = useState(false);

  async function reorder() {
    setIsLoading(true);
    setMessage("");
    setAddedToCart(false);
    const { data, error } = await createClient()
      .from("order_items")
      .select("product_id, quantity, products(id, name, slug, price, stock_quantity, is_active, product_images(image_url, position))")
      .eq("order_id", orderId);
    setIsLoading(false);
    if (error) {
      setMessage("We couldn’t check these items right now. Please try again.");
      return;
    }

    let added = 0;
    let unavailable = 0;
    for (const item of (data ?? []) as OrderItemRow[]) {
      const product = nestedProduct(item.products);
      if (!product || !product.is_active || product.stock_quantity < 1) {
        unavailable += 1;
        continue;
      }
      const quantity = Math.min(item.quantity, product.stock_quantity);
      const image = product.product_images?.slice().sort((a, b) => a.position - b.position)[0]?.image_url ?? "";
      addItem({
        productId: product.id,
        slug: product.slug,
        name: product.name,
        price: Number(product.price),
        image,
        quantity,
      });
      added += 1;
      if (quantity < item.quantity) unavailable += 1;
    }

    if (added && unavailable) {
      setMessage(`${added} item${added === 1 ? "" : "s"} added. ${unavailable} item${unavailable === 1 ? " is" : "s are"} currently unavailable.`);
      setAddedToCart(true);
    } else if (added) {
      setMessage(`Added ${added} item${added === 1 ? "" : "s"} to your cart.`);
      setAddedToCart(true);
    } else {
      setMessage("These items are currently unavailable.");
    }
  }

  return (
    <>
      <button
        className="rounded-lg border border-forest-green/20 px-3 py-2 text-sm font-semibold text-forest-green disabled:opacity-60"
        disabled={isLoading}
        onClick={() => void reorder()}
        type="button"
      >
        {isLoading ? "Checking items..." : "Reorder"}
      </button>
      {message ? <span aria-live="polite" className="text-sm text-muted">{message}</span> : null}
      {addedToCart ? (
        <Link className="text-sm font-semibold text-forest-green underline underline-offset-4" href="/cart">
          View cart
        </Link>
      ) : null}
    </>
  );
}
