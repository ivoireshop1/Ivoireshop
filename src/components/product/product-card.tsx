"use client";

import { ProductImage } from "@/src/components/product/product-image";
import Link from "next/link";
import { useState } from "react";
import type { Product } from "@/src/types/catalog";
import { useCart } from "@/src/lib/cart/cart-context";
import { WishlistButton } from "@/src/components/wishlist/wishlist-button";
import { ProductBadge } from "./product-badge";
import { publicStockLabel, remainingPurchasableQuantity } from "@/src/lib/catalog/inventory";
import { buildProductPath } from "@/src/lib/navigation/smart-navigation";

export function ProductCard({ product, returnTo }: { product: Product; returnTo?: string }) {
  const { addItem, items } = useCart();
  const [added, setAdded] = useState(false);
  const badge = product.isComingSoon ? "Coming Soon" : product.isNew ? "New" : product.isPopular ? "Popular" : product.isFeatured ? "Featured" : null;
  const cartItem = items.find((item) => item.productId === product.id);
  const remaining = remainingPurchasableQuantity(product.trackInventory, product.stockQuantity, cartItem?.quantity ?? 0);
  const unavailable = product.isComingSoon || remaining <= 0 || product.price <= 0;
  const stockLabel = publicStockLabel(product.trackInventory, product.stockQuantity);
  function add() { if (unavailable) return; addItem({ productId: product.id, slug: product.slug, name: product.name, price: product.price, image: product.image, quantity: 1 }); setAdded(true); setTimeout(() => setAdded(false), 1600); }
  const href = buildProductPath(product.slug, returnTo);
  return (
    <article className="group rounded-xl bg-surface p-3 text-foreground shadow-sm">
      <Link className="relative block aspect-square overflow-hidden rounded-2xl bg-[#eadfce]" href={href}>
        <ProductImage alt={product.name} className="object-cover transition duration-300 group-hover:scale-105" fill sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw" src={product.image} />
        {badge && <ProductBadge label={badge} />}
      </Link>
      <div className="pt-4">
        <p className="text-xs text-muted">{product.category}</p>
        <Link className="mt-1 block break-words font-semibold text-foreground hover:text-forest-green" href={href}>{product.name}</Link>
        <p className="mt-1 text-xs text-muted">{product.isComingSoon ? "Preview" : stockLabel}</p>
        <p className="mt-3 font-semibold text-forest-green">{product.isComingSoon || !Number.isFinite(product.price) ? "Coming soon" : `$${product.price.toFixed(2)}`}</p>
        <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
          <WishlistButton productId={product.id} productName={product.name} />
          {product.isComingSoon ? null : cartItem ? (
            <button disabled={unavailable} aria-label={`Add another ${product.name} to cart`} className="min-h-11 rounded-lg border border-forest-green/20 bg-[#f5f0e6] px-3 py-2 text-sm font-semibold text-forest-green disabled:opacity-50" onClick={add} type="button">{added ? "✓ Added" : `Add another (${cartItem.quantity})`}</button>
          ) : (
            <button disabled={unavailable} aria-label={`Add ${product.name} to cart`} className="min-h-11 rounded-lg bg-forest-green px-3 py-2 text-sm font-semibold text-white disabled:opacity-50" onClick={add} type="button">{unavailable ? "Unavailable" : "Add to Cart"}</button>
          )}
          <Link className="min-h-11 inline-flex items-center text-sm font-semibold text-forest-green underline underline-offset-4" href={href}>View Product</Link>
        </div>
      </div>
    </article>
  );
}
