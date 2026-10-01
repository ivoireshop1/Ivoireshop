"use client";

import { useState } from "react";
import Image from "next/image";
import type { CartItem } from "@/src/types/cart";
import { shippingSummaryLabel } from "@/src/lib/delivery/labels";
import type { TaxMode } from "@/src/lib/tax/totals";

type SummaryItem = Pick<CartItem, "productId" | "name" | "quantity"> & Partial<Pick<CartItem, "price" | "image">>;

export function CheckoutOrderSummary({
  items,
  subtotal,
  shipping,
  tax,
  total,
  taxLabel,
  taxMode,
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
  taxMode?: TaxMode | null;
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
    <section className="min-w-0 rounded-2xl border border-black/10 bg-white p-3 sm:p-5">
      <h2 className="text-xl font-semibold text-forest-green">Order Summary</h2>
      <div className="mt-4 flex min-w-0 items-start gap-3">
        <div className="w-[4.75rem] shrink-0 sm:w-[5.5rem]">
          <div className="relative h-12 w-12 overflow-hidden rounded-xl bg-[#eadfce] sm:h-14 sm:w-14">
            {thumb ? <Image alt="" className="object-cover" fill sizes="56px" src={thumb} /> : null}
          </div>
          <p className="mt-2 text-xs font-semibold leading-tight text-forest-green">{count} item{count === 1 ? "" : "s"}</p>
          <button className="mt-1 text-left text-xs font-semibold text-forest-green underline underline-offset-2" onClick={() => setOpen((value) => !value)} type="button">
            {open ? "Hide items" : "View items"}
          </button>
        </div>
        <dl className="min-w-0 flex-1 space-y-2 text-sm">
          <MoneyRow label="Subtotal" value={money(subtotal)} />
          <MoneyRow label={shippingSummaryLabel(provider)} value={money(shipping)} />
          <MoneyRow label={taxLabel} value={money(tax)} />
          <MoneyRow emphasize label="Total" value={money(total)} />
        </dl>
      </div>
      {taxMode === "not_configured" ? (
        <p className="mt-3 text-xs text-muted">Tax is not configured yet. This checkout does not collect a tax amount.</p>
      ) : null}
      {open ? (
        <ul className="mt-4 space-y-2 border-t border-black/10 pt-3 text-sm">
          {items.map((item) => (
            <li className="flex justify-between gap-3" key={item.productId}>
              <span className="min-w-0 break-words">{item.name} × {item.quantity}</span>
              <span className="shrink-0 whitespace-nowrap tabular-nums">{item.price != null ? `$${(item.price * item.quantity).toFixed(2)}` : ""}</span>
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

function MoneyRow({ label, value, emphasize }: { label: string; value: string; emphasize?: boolean }) {
  return (
    <div className={`flex items-baseline justify-between gap-2 ${emphasize ? "font-semibold text-forest-green" : ""}`}>
      <dt className="min-w-0 truncate">{label}</dt>
      <dd className="shrink-0 whitespace-nowrap tabular-nums">{value}</dd>
    </div>
  );
}
