"use client";

import Image from "next/image";
import Link from "next/link";
import type { CartItem as CartItemType } from "@/src/types/cart";
import { useCart } from "@/src/lib/cart/cart-context";

export function CartItem({ item }: { item: CartItemType }) {
  const { incrementQuantity, decrementQuantity, removeItem } = useCart();

  return (
    <article className="flex gap-4 rounded-2xl border border-black/8 bg-surface p-4 shadow-[0_12px_25px_rgba(23,63,53,0.04)] transition hover:border-forest-green/20 hover:shadow-[0_18px_35px_rgba(23,63,53,0.08)]">
      <Link className="relative h-24 w-24 shrink-0 overflow-hidden rounded-xl bg-[#eadfce]" href={`/product/${item.slug}`}>
        <Image alt={item.name} className="object-cover" fill sizes="96px" src={item.image} />
      </Link>

      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-4">
          <Link className="font-semibold text-forest-green hover:underline" href={`/product/${item.slug}`}>
            {item.name}
          </Link>
          <p className="shrink-0 font-semibold text-forest-green">${(item.price * item.quantity).toFixed(2)}</p>
        </div>

        <p className="mt-1 text-sm text-muted">${item.price.toFixed(2)} each</p>

        <div className="mt-3 flex flex-wrap items-center gap-3">
          <div className="inline-flex items-center overflow-hidden rounded-lg border border-black/15 bg-white shadow-sm">
            <button
              aria-label={`Decrease quantity for ${item.name}`}
              className="flex h-10 w-10 items-center justify-center text-lg font-semibold text-forest-green transition hover:bg-[#f5f0e6] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-forest-green/60 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
              disabled={item.quantity <= 1}
              onClick={() => decrementQuantity(item.productId)}
              type="button"
            >
              −
            </button>

            <span className="min-w-10 px-2 text-center text-sm font-medium text-slate-800" aria-live="polite" aria-atomic="true">
              {item.quantity}
            </span>

            <button
              aria-label={`Increase quantity for ${item.name}`}
              className="flex h-10 w-10 items-center justify-center text-lg font-semibold text-forest-green transition hover:bg-[#f5f0e6] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-forest-green/60 focus-visible:ring-offset-2"
              onClick={() => incrementQuantity(item.productId)}
              type="button"
            >
              +
            </button>
          </div>

          <button
            aria-label={`Remove ${item.name} from cart`}
            className="text-sm text-muted underline underline-offset-4 transition hover:text-forest-green"
            onClick={() => removeItem(item.productId)}
            type="button"
          >
            Remove
          </button>
        </div>
      </div>
    </article>
  );
}
