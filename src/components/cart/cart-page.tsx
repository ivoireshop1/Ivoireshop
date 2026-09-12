"use client";

import Link from "next/link";
import { SmartBackButton } from "@/src/components/navigation/smart-back-button";
import { useCart } from "@/src/lib/cart/cart-context";
import { CartEmptyState } from "./cart-empty-state";
import { CartItem } from "./cart-item";
import { CartSummary } from "./cart-summary";

export function CartPage() {
  const { items, subtotal, isLoaded } = useCart();
  if (!isLoaded) return <main className="mx-auto w-full max-w-7xl px-5 py-16 lg:px-8"><p className="text-muted">Loading cart...</p></main>;
  return <main className="mx-auto w-full max-w-7xl px-5 py-10 lg:px-8"><SmartBackButton fallbackHref="/shop" fallbackLabel="Browse products" /><div className="mt-8 flex flex-wrap items-end justify-between gap-4"><div><p className="text-xs font-semibold uppercase tracking-[0.2em] text-gold">Your selections</p><h1 className="mt-2 text-4xl font-semibold text-forest-green">Cart</h1>{items.length > 0 && <p className="mt-2 text-sm text-muted">Your cart is saved</p>}</div><Link className="text-sm font-semibold text-forest-green underline underline-offset-4" href="/shop">Continue shopping</Link></div>{items.length === 0 ? <div className="mt-10"><CartEmptyState /></div> : <div className="mt-10 grid gap-10 lg:grid-cols-[1fr_340px]"><section aria-label="Cart items">{items.map((item) => <CartItem item={item} key={item.productId} />)}</section><CartSummary subtotal={subtotal} /></div>}</main>;
}
