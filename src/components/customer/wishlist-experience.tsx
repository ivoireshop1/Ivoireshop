"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import { useWishlist } from "@/src/lib/wishlist/wishlist-context";
import { useCart } from "@/src/lib/cart/cart-context";

export function WishlistExperience() {
  const { items, removeItem } = useWishlist();
  const { addItem, items: cartItems } = useCart();
  const [addedId, setAddedId] = useState<string | null>(null);
  const products = items.map((item) => item.product).filter((product): product is NonNullable<typeof product> => Boolean(product));
  if (!products.length) return <div className="mx-auto max-w-xl px-5 py-24 text-center"><div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-[#e9e0d0] text-3xl text-gold">♡</div><h1 className="mt-6 text-3xl font-semibold text-forest-green">Your Wishlist Is Empty</h1><p className="mt-3 text-muted">Save products you love and come back to them anytime.</p><Link className="mt-7 inline-flex rounded-lg bg-forest-green px-5 py-3 text-sm font-semibold text-white" href="/shop">Explore Products</Link></div>;
  return <section className="mx-auto max-w-7xl px-5 py-14 lg:px-8"><div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">{products.map((product) => { const cartItem = cartItems.find((item) => item.productId === product.id); return <article className="rounded-xl bg-surface p-3 shadow-sm" key={product.id}><div className="relative aspect-square overflow-hidden rounded-xl bg-[#eadfce]"><Image alt={product.name} className="object-cover" fill sizes="(max-width: 640px) 90vw, 25vw" src={product.image} /></div><p className="mt-4 text-xs text-muted">{product.category}</p><h2 className="mt-1 font-semibold text-forest-green">{product.name}</h2><p className="mt-2 font-semibold text-forest-green">${product.price.toFixed(2)}</p><div className="mt-4 flex flex-wrap gap-3 text-sm"><Link className="font-semibold text-forest-green underline underline-offset-4" href={`/product/${product.slug}`}>View product</Link><button aria-label={`Add another ${product.name} to cart`} className="font-semibold text-forest-green underline underline-offset-4" onClick={() => { addItem({ productId: product.id, slug: product.slug, name: product.name, price: product.price, image: product.image, quantity: 1 }); setAddedId(product.id); }} type="button">{addedId === product.id ? "✓ Added" : cartItem ? `✓ In cart (${cartItem.quantity})` : "Add to cart"}</button>{cartItem && <Link className="text-muted underline underline-offset-4" href="/cart">View cart</Link>}<button className="text-muted underline underline-offset-4" onClick={() => void removeItem(product.id)} type="button">Remove</button></div></article>; })}</div></section>;
}
