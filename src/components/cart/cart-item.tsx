"use client";

import { useEffect, useState } from "react";
import { ProductImage } from "@/src/components/product/product-image";
import Link from "next/link";
import type { CartItem as CartItemType } from "@/src/types/cart";
import { useCart } from "@/src/lib/cart/cart-context";
import { settingsFromCartItem } from "@/src/lib/cart/cart-utils";
import { formatSellQuantity, lineSubtotal, roundQty, snapQuantity, unitLabel } from "@/src/lib/catalog/selling";

export function CartItem({ item }: { item: CartItemType }) {
  const { incrementQuantity, decrementQuantity, removeItem, updateQuantity } = useCart();
  const settings = settingsFromCartItem(item);
  const weightBased = settings.sellingMethod === "weight";
  const atMin = item.quantity <= settings.minSellQty + 1e-9;
  const atMax = settings.maxSellQty != null && item.quantity >= settings.maxSellQty - 1e-9;
  const [draft, setDraft] = useState(() => String(roundQty(item.quantity)));

  useEffect(() => {
    setDraft(String(roundQty(item.quantity)));
  }, [item.quantity]);

  function commitDraft() {
    const parsed = Number(String(draft).trim().replace(/,/g, ""));
    if (!Number.isFinite(parsed)) {
      setDraft(String(roundQty(item.quantity)));
      return;
    }
    updateQuantity(item.productId, snapQuantity(parsed, settings));
  }

  return (
    <article className="flex gap-4 rounded-2xl border border-black/8 bg-surface p-4 shadow-[0_12px_25px_rgba(23,63,53,0.04)] transition hover:border-forest-green/20 hover:shadow-[0_18px_35px_rgba(23,63,53,0.08)]">
      <Link className="relative h-24 w-24 shrink-0 overflow-hidden rounded-xl bg-[#eadfce]" href={`/product/${item.slug}`}>
        <ProductImage alt={item.name} className="object-cover" fill sizes="96px" src={item.image} />
      </Link>

      <div className="min-w-0 flex-1">
        <div className="flex flex-col items-start gap-1 sm:flex-row sm:justify-between sm:gap-4">
          <Link className="font-semibold text-forest-green hover:underline" href={`/product/${item.slug}`}>
            {item.name}
          </Link>
          <p className="shrink-0 font-semibold text-forest-green">${lineSubtotal(item.price, item.quantity).toFixed(2)}</p>
        </div>

        <p className="mt-1 text-sm text-muted">
          ${item.price.toFixed(2)} / {unitLabel(settings.sellingUnit, 1)}
        </p>

        <div className="mt-3 flex flex-wrap items-center gap-3">
          <div className="inline-flex items-center overflow-hidden rounded-lg border border-black/15 bg-white shadow-sm">
            <button
              aria-label={`Decrease quantity for ${item.name}`}
              className="flex h-10 w-10 items-center justify-center text-lg font-semibold text-forest-green transition hover:bg-[#f5f0e6] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-forest-green/60 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
              disabled={atMin}
              onClick={() => decrementQuantity(item.productId)}
              type="button"
            >
              −
            </button>

            {weightBased ? (
              <input
                aria-label={`Weight for ${item.name}`}
                className="h-10 w-20 border-x border-black/10 px-1 text-center text-sm font-medium tabular-nums text-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-forest-green/50"
                inputMode="decimal"
                onBlur={commitDraft}
                onChange={(event) => setDraft(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    commitDraft();
                  }
                }}
                step={settings.unitIncrement}
                type="number"
                value={draft}
              />
            ) : (
              <span className="min-w-14 px-2 text-center text-sm font-medium text-slate-800" aria-live="polite" aria-atomic="true">
                {item.quantity}
              </span>
            )}

            <button
              aria-label={`Increase quantity for ${item.name}`}
              className="flex h-10 w-10 items-center justify-center text-lg font-semibold text-forest-green transition hover:bg-[#f5f0e6] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-forest-green/60 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
              disabled={atMax}
              onClick={() => incrementQuantity(item.productId)}
              type="button"
            >
              +
            </button>
          </div>

          {weightBased ? (
            <span className="text-sm text-muted">{formatSellQuantity(item.quantity, settings.sellingUnit)}</span>
          ) : null}

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
