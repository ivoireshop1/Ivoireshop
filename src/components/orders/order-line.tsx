"use client";

import Image from "next/image";
import { useEffect, useId, useState } from "react";
import { isNextImageSrc } from "@/src/lib/catalog/image-url";
import { orderLineImage, type OrderLineItem } from "@/src/lib/orders/line-image";

export function OrderLine({
  item,
  expandable = false,
}: {
  item: OrderLineItem;
  expandable?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [broken, setBroken] = useState(false);
  const titleId = useId();
  const src = broken ? "" : orderLineImage(item);
  const unit = Number(item.product_price);
  const line = unit * Number(item.quantity);

  useEffect(() => {
    if (!open) return;
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <>
      <div className="flex items-start gap-3 border-b border-black/10 py-3 last:border-b-0">
        <button
          aria-label={expandable ? `Expand ${item.product_name}` : item.product_name}
          className="relative h-16 w-16 shrink-0 overflow-hidden rounded-xl bg-[#eadfce]"
          disabled={!expandable || !src}
          onClick={() => expandable && src && setOpen(true)}
          type="button"
        >
          {src && isNextImageSrc(src) ? (
            <Image alt="" className="object-cover" fill onError={() => setBroken(true)} sizes="64px" src={src} unoptimized />
          ) : (
            <span className="flex h-full items-center justify-center px-1 text-center text-[10px] font-semibold uppercase tracking-wide text-forest-green">Ivoire</span>
          )}
        </button>
        <div className="min-w-0 flex-1">
          <p className="break-words font-medium text-forest-green">{item.product_name}</p>
          <p className="mt-1 text-sm text-muted">Qty {item.quantity} · ${unit.toFixed(2)} each</p>
        </div>
        <p className="shrink-0 font-semibold tabular-nums text-forest-green">${line.toFixed(2)}</p>
      </div>
      {open && src ? (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/50 p-4" role="dialog" aria-modal="true" aria-labelledby={titleId}>
          <div className="max-h-[90dvh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white p-4">
            <div className="flex items-start justify-between gap-3">
              <h2 className="text-lg font-semibold text-forest-green" id={titleId}>{item.product_name}</h2>
              <button aria-label="Close image preview" className="inline-flex min-h-11 min-w-11 items-center justify-center font-semibold text-forest-green" onClick={() => setOpen(false)} type="button">
                Close
              </button>
            </div>
            <div className="relative mt-3 aspect-square overflow-hidden rounded-xl bg-[#eadfce]">
              <Image alt={item.product_name} className="object-contain" fill onError={() => setBroken(true)} sizes="90vw" src={src} unoptimized />
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
