"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useCart } from "@/src/lib/cart/cart-context";

export function CartFeedback() {
  const { lastAddedItem, addEventId } = useCart();
  const [dismissedEventId, setDismissedEventId] = useState(0);

  useEffect(() => {
    if (!lastAddedItem || addEventId === dismissedEventId) return;
    const timer = window.setTimeout(() => setDismissedEventId(addEventId), 3200);
    return () => window.clearTimeout(timer);
  }, [lastAddedItem, addEventId, dismissedEventId]);

  if (!lastAddedItem || addEventId === dismissedEventId) return null;

  return (
    <div aria-live="polite" className="cart-feedback fixed bottom-5 right-5 z-50 w-[min(calc(100vw-2rem),24rem)] rounded-2xl border border-forest-green/10 bg-surface p-4 text-foreground shadow-xl">
      <div className="flex items-start gap-3">
        <span aria-hidden="true" className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-forest-green text-sm font-bold text-white">✓</span>
        <div className="min-w-0 flex-1">
          <p className="font-semibold text-forest-green">Added to your cart</p>
          <div className="mt-3 flex items-center gap-3">
            <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-lg bg-[#eadfce]">
              <Image alt="" className="object-cover" fill sizes="48px" src={lastAddedItem.image} />
            </div>
            <div className="min-w-0">
              <p className="truncate text-sm font-medium">{lastAddedItem.name}</p>
              <p className="text-xs text-muted">Quantity: {lastAddedItem.quantity}</p>
            </div>
          </div>
          <div className="mt-3 flex gap-4 text-sm font-semibold">
            <Link className="text-forest-green underline underline-offset-4" href="/shop">Continue shopping</Link>
            <Link className="text-forest-green underline underline-offset-4" href="/cart">View cart</Link>
          </div>
        </div>
      </div>
    </div>
  );
}
