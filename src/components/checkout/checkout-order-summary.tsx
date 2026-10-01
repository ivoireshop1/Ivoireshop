"use client";

import { useState } from "react";
import Image from "next/image";
import type { CartItem } from "@/src/types/cart";
import { shippingSummaryLabel } from "@/src/lib/delivery/labels";

type SummaryItem = Pick<CartItem, "productId" | "name" | "quantity"> & Partial<Pick<CartItem, "price" | "image">>;

export function CheckoutOrderSummary({
  items,
  subtotal,
  shipping,
  tax,
  total,
  taxLabel,
  provider,
  continueLabel,
  continueDisabled,
  continueType = "button",
  onContinue,
}: {
  items: SummaryItem[];
  subtotal: number;
  shipping: number | null;
  tax: number | null;
  total: number | null;
  taxLabel: string;
  provider?: string | null;
  continueLabel: string;
  continueDisabled?: boolean;
  continueType?: "button" | "submit";
  onContinue?: () => void;
}) {
  const [open, setOpen] = useState(false);
  const count = items.reduce((sum, item) => sum + item.quantity, 0);
  const thumb = items.find((item) => item.image)?.image || items[0]?.image || "";
  const money = (value: number | null) => (value == null ? "—" : `$${value.toFixed(2)}`);
  return (
    <section className="min-w-0 overflow-hidden rounded-2xl border border-black/10 bg-white p-4 sm:p-5">
      <h2 className="text-xl font-semibold text-forest-green">Order Summary</h2>
      <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-[minmax(0,7.5rem)_minmax(0,1fr)]">
        <div className="flex min-w-0 items-start gap-3">
          <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-xl bg-[#eadfce]">
            {thumb ? <Image alt="" className="object-cover" fill sizes="64px" src={thumb} /> : null}
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-forest-green">{count} item{count === 1 ? "" : "s"}</p>
            <button className="mt-1 text-sm font-semibold text-forest-green underline underline-offset-4" onClick={() => setOpen((value) => !value)} type="button">
              {open ? "Hide items" : "View items"}
            </button>
          </div>
        </div>
        <dl className="min-w-0 space-y-2 text-sm">
          <div className="flex justify-between gap-3">
            <dt className="min-w-0">Subtotal</dt>
            <dd className="shrink-0 tabular-nums">{money(subtotal)}</dd>
          </div>
          <div className="flex justify-between gap-3">
            <dt className="min-w-0">{shippingSummaryLabel(provider)}</dt>
            <dd className="shrink-0 tabular-nums">{money(shipping)}</dd>
          </div>
          <div className="flex justify-between gap-3">
            <dt className="min-w-0">{taxLabel}</dt>
            <dd className="shrink-0 tabular-nums">{money(tax)}</dd>
          </div>
          <div className="flex justify-between gap-3 font-semibold text-forest-green">
            <dt>Total</dt>
            <dd className="shrink-0 tabular-nums">{money(total)}</dd>
          </div>
        </dl>
      </div>
      {open ? (
        <ul className="mt-4 space-y-2 border-t border-black/10 pt-3 text-sm">
          {items.map((item) => (
            <li className="flex justify-between gap-3" key={item.productId}>
              <span className="min-w-0 break-words">{item.name} × {item.quantity}</span>
              <span className="shrink-0 tabular-nums">{item.price != null ? `$${(item.price * item.quantity).toFixed(2)}` : ""}</span>
            </li>
          ))}
        </ul>
      ) : null}
      <button
        className="mt-5 min-h-12 w-full rounded-xl bg-forest-green px-4 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
        disabled={continueDisabled}
        onClick={onContinue}
        type={continueType}
      >
        {continueLabel}
      </button>
    </section>
  );
}
