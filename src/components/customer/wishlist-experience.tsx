"use client";

import { ProductImage } from "@/src/components/product/product-image";
import Link from "next/link";
import { useState } from "react";
import { useWishlist } from "@/src/lib/wishlist/wishlist-context";
import { useCart } from "@/src/lib/cart/cart-context";
import type { WishlistItem } from "@/src/types/wishlist";

function availabilityLabel(item: WishlistItem) {
  if (!item.product) return "No longer available";
  if (!(Number(item.product.stockQuantity) > 0)) return "Sold Out";
  return "Available";
}

export function WishlistExperience() {
  const { items, removeItem, isLoading, error, refreshWishlist } = useWishlist();
  const { addItem, items: cartItems } = useCart();
  const [addedId, setAddedId] = useState<string | null>(null);

  if (isLoading && items.length === 0) return <p role="status" className="px-5 py-16 text-center text-muted">Loading your wishlist...</p>;
  if (error) return <div role="alert" className="px-5 py-16 text-center"><p>Your wishlist could not be updated. Please try again.</p><button className="mt-5 rounded-lg bg-forest-green px-5 py-3 text-white" onClick={() => void refreshWishlist()} type="button">Try again</button></div>;

  if (!items.length) {
    return (
      <div className="mx-auto max-w-xl px-5 py-24 text-center">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-[#e9e0d0] text-3xl text-gold">♡</div>
        <h1 className="mt-6 text-3xl font-semibold text-forest-green">Your Wishlist Is Empty</h1>
        <p className="mt-3 text-muted">Save products you love and come back to them anytime.</p>
        <Link className="mt-7 inline-flex rounded-lg bg-forest-green px-5 py-3 text-sm font-semibold text-white" href="/shop">Explore Products</Link>
      </div>
    );
  }

  return (
    <section className="mx-auto max-w-7xl px-5 py-14 lg:px-8">
      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
        {items.map((item) => {
          const product = item.product;
          const status = availabilityLabel(item);
          const isSoldOut = status === "Sold Out";
          const isUnavailable = !product;
          const cartItem = product ? cartItems.find((cartLine) => cartLine.productId === product.id) : undefined;

          return (
            <article className="rounded-xl bg-surface p-3 shadow-sm" key={item.id}>
              <div className="relative aspect-square overflow-hidden rounded-xl bg-[#eadfce]">
                {product ? (
                  <ProductImage alt={product.name} className="object-cover" fill sizes="(max-width: 640px) 90vw, 25vw" src={product.image} />
                ) : (
                  <div className="flex h-full items-center justify-center text-sm text-muted">Unavailable</div>
                )}
                {(isSoldOut || isUnavailable) && (
                  <span className="absolute left-2 top-2 rounded-full bg-black/70 px-2 py-1 text-xs font-semibold text-white">{status}</span>
                )}
              </div>
              {product ? (
                <>
                  <p className="mt-4 text-xs text-muted">{product.category}</p>
                  <h2 className="mt-1 font-semibold text-forest-green">{product.name}</h2>
                  <p className="mt-2 font-semibold text-forest-green">${product.price.toFixed(2)}</p>
                  <div className="mt-4 flex flex-wrap gap-3 text-sm">
                    <Link className="font-semibold text-forest-green underline underline-offset-4" href={`/product/${product.slug}`}>View product</Link>
                    <button
                      aria-label={isSoldOut ? `${product.name} is sold out` : `Add another ${product.name} to cart`}
                      className="font-semibold text-forest-green underline underline-offset-4 disabled:cursor-not-allowed disabled:text-muted disabled:no-underline"
                      disabled={isSoldOut || (cartItem?.quantity ?? 0) >= Number(product.stockQuantity)}
                      onClick={() => { addItem({ productId: product.id, slug: product.slug, name: product.name, price: product.price, image: product.image, quantity: 1 }); setAddedId(product.id); }}
                      type="button"
                    >
                      {isSoldOut ? "Sold Out" : addedId === product.id ? "✓ Added" : cartItem ? `✓ In cart (${cartItem.quantity})` : "Add to cart"}
                    </button>
                    {cartItem && <Link className="text-muted underline underline-offset-4" href="/cart">View cart</Link>}
                    <button className="text-muted underline underline-offset-4" onClick={() => void removeItem(item.productId).catch(() => { /* The provider displays the failure. */ })} type="button">Remove</button>
                  </div>
                </>
              ) : (
                <>
                  <p className="mt-4 text-sm text-muted">This saved item is no longer available.</p>
                  <div className="mt-4 flex flex-wrap gap-3 text-sm">
                    <button className="text-muted underline underline-offset-4" onClick={() => void removeItem(item.productId).catch(() => { /* The provider displays the failure. */ })} type="button">Remove</button>
                  </div>
                </>
              )}
            </article>
          );
        })}
      </div>
    </section>
  );
}
