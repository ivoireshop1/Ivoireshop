"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import type { Product } from "@/src/types/catalog";
import { useCart } from "@/src/lib/cart/cart-context";
import { WishlistButton } from "@/src/components/wishlist/wishlist-button";
import { ProductBadge } from "./product-badge";
import { buildProductPath } from "@/src/lib/navigation/smart-navigation";

export function ProductCard({ product, returnTo }: { product: Product; returnTo?: string }) {
  const { addItem } = useCart();
  const [added, setAdded] = useState(false);
  const badge = product.isNew ? "New" : product.isPopular ? "Popular" : product.isFeatured ? "Featured" : null;
  function add() { addItem({ productId: product.id, slug: product.slug, name: product.name, price: product.price, image: product.image, quantity: 1 }); setAdded(true); setTimeout(() => setAdded(false), 1200); }
  return <article className="group rounded-xl bg-surface p-3 text-foreground shadow-sm">
    <Link className="relative block aspect-[4/5] overflow-hidden rounded-2xl bg-[#eadfce]" href={buildProductPath(product.slug, returnTo)}>
      <Image alt={product.name} className="object-cover transition duration-300 group-hover:scale-105" fill sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw" src={product.image} />
      {badge && <ProductBadge label={badge} />}
    </Link>
    <div className="pt-4">
      <p className="text-xs text-muted">{product.category} · {product.weight}</p>
      <Link className="mt-1 block font-semibold text-foreground hover:text-forest-green" href={buildProductPath(product.slug, returnTo)}>{product.name}</Link>
      <div className="mt-2 flex items-center gap-2 text-xs text-gold" aria-label="Rated 5 out of 5 stars">★★★★★ <span className="text-muted">(24)</span></div>
      <div className="mt-3 flex items-center justify-between gap-2"><span className="font-semibold text-forest-green">${product.price.toFixed(2)}</span><div className="flex items-center gap-2"><WishlistButton productId={product.id} productName={product.name} /><button aria-label={`Add ${product.name} to cart`} className="text-sm font-semibold text-forest-green underline underline-offset-4" onClick={add} type="button">{added ? "Added" : "Add to cart"}</button></div></div>
    </div>
  </article>;
}
