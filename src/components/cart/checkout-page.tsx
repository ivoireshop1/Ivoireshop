"use client";

import Link from "next/link";
import { SmartBackButton } from "@/src/components/navigation/smart-back-button";
import { useCart } from "@/src/lib/cart/cart-context";

export function CheckoutPage() {
  const { items, subtotal, isLoaded } = useCart();
  return <main className="mx-auto w-full max-w-4xl px-5 py-10 lg:px-8"><SmartBackButton fallbackHref="/cart" fallbackLabel="Back to cart" /><div className="mt-8 rounded-2xl bg-[#f5f0e6] p-6 sm:p-10"><p className="text-xs font-semibold uppercase tracking-[0.2em] text-gold">Coming next</p><h1 className="mt-2 text-4xl font-semibold text-forest-green">Checkout</h1><p className="mt-4 max-w-lg leading-7 text-muted">Checkout is being prepared. Your cart is saved and ready. Payment and order processing will be added in a later phase.</p>{isLoaded && <div className="mt-8 border-t border-black/10 pt-6"><div className="flex justify-between font-semibold text-forest-green"><span>{items.length} product{items.length === 1 ? "" : "s"}</span><span>${subtotal.toFixed(2)} subtotal</span></div></div>}<div className="mt-8 flex flex-wrap gap-3"><Link className="rounded-lg bg-forest-green px-5 py-3 text-sm font-semibold text-white" href="/cart">Back to cart</Link><Link className="rounded-lg border border-forest-green/20 px-5 py-3 text-sm font-semibold text-forest-green" href="/shop">Continue shopping</Link></div></div></main>;
}
