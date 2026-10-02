"use client";

import Image from "next/image";
import { useEffect, useId, useState, useTransition } from "react";
import { isNextImageSrc } from "@/src/lib/catalog/image-url";
import { orderLineImage } from "@/src/lib/orders/line-image";
import { pickingProgress, splitProductLabel } from "@/src/lib/orders/ops";
import { setOrderItemPicked } from "@/src/lib/admin/order-ops-actions";
import { createClient } from "@/src/lib/supabase/browser";
import { useLiveNotifications } from "@/src/components/realtime/live-notifications-provider";

export type PickingLine = {
  id: string;
  product_name: string;
  product_price: number | string;
  quantity: number;
  image_url?: string | null;
  catalog_image_url?: string | null;
  picked: boolean;
};

export function AdminOrderPicking({ orderId, items }: { orderId: string; items: PickingLine[] }) {
  const live = useLiveNotifications();
  const [rows, setRows] = useState(items);
  const [preview, setPreview] = useState<number | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [, startTransition] = useTransition();
  const titleId = useId();
  const tick = live.orderTicks[orderId];
  const progress = pickingProgress(rows.length, rows.filter((row) => row.picked).length);

  useEffect(() => {
    if (!tick) return;
    const client = createClient();
    let cancelled = false;
    void client.from("order_item_picks").select("order_item_id").eq("order_id", orderId).then(({ data }) => {
      if (cancelled || !data) return;
      const picked = new Set(data.map((row) => row.order_item_id));
      setRows((current) => current.map((row) => ({ ...row, picked: picked.has(row.id) })));
    });
    return () => {
      cancelled = true;
    };
  }, [orderId, tick]);

  function toggle(item: PickingLine) {
    if (busyId) return;
    const nextPicked = !item.picked;
    setBusyId(item.id);
    setRows((current) => current.map((row) => (row.id === item.id ? { ...row, picked: nextPicked } : row)));
    startTransition(async () => {
      const result = await setOrderItemPicked(orderId, item.id, nextPicked);
      setBusyId(null);
      if (result.error) {
        setRows((current) => current.map((row) => (row.id === item.id ? { ...row, picked: item.picked } : row)));
        return;
      }
      live.bumpLiveOrder(orderId);
    });
  }

  const previewItem = preview == null ? null : rows[preview];
  const previewSrc = previewItem ? orderLineImage(previewItem) : "";

  return (
    <section className="rounded-2xl bg-white p-5">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <h2 className="font-semibold text-[#173f35]">Pick products</h2>
        <p className="text-sm font-semibold text-[#173f35]">{progress.label}</p>
      </div>
      <ul className="mt-4 space-y-3">
        {rows.map((item, index) => {
          const src = orderLineImage(item);
          const parts = splitProductLabel(item.product_name);
          const unit = Number(item.product_price);
          const line = unit * Number(item.quantity);
          return (
            <li className="flex min-w-0 items-start gap-3 rounded-2xl border border-[#173f35]/10 p-3" key={item.id}>
              <button
                aria-label={`Preview ${item.product_name}`}
                className="relative h-24 w-24 shrink-0 overflow-hidden rounded-xl bg-[#eadfce] sm:h-28 sm:w-28"
                onClick={() => src && setPreview(index)}
                type="button"
              >
                {src && isNextImageSrc(src) ? (
                  <Image alt="" className="object-cover" fill sizes="112px" src={src} unoptimized />
                ) : (
                  <span className="flex h-full items-center justify-center px-1 text-center text-[10px] font-semibold uppercase tracking-wide text-[#173f35]">Ivoire</span>
                )}
              </button>
              <div className="min-w-0 flex-1">
                <p className="break-words font-semibold text-[#173f35]">{parts.title}</p>
                {parts.variant ? <p className="mt-0.5 text-sm text-[#6b6b6b]">{parts.variant}</p> : null}
                <p className="mt-1 text-sm text-[#173f35]">Quantity: {item.quantity}</p>
                <p className="text-sm text-[#6b6b6b]">${unit.toFixed(2)} each</p>
                <p className="mt-1 font-semibold tabular-nums text-[#173f35]">${line.toFixed(2)}</p>
                <button
                  aria-pressed={item.picked}
                  className={`mt-3 inline-flex min-h-11 min-w-11 items-center rounded-xl px-3 text-sm font-semibold ${item.picked ? "bg-[#173f35] text-white" : "border border-[#173f35]/20 text-[#173f35]"}`}
                  disabled={busyId === item.id}
                  onClick={() => toggle(item)}
                  type="button"
                >
                  {item.picked ? "☑ Picked" : `☐ ${parts.title} ×${item.quantity}`}
                </button>
              </div>
            </li>
          );
        })}
      </ul>
      {previewItem && previewSrc ? (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/50 p-4" role="dialog" aria-modal="true" aria-labelledby={titleId}>
          <div className="max-h-[90dvh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white p-4">
            <div className="flex items-start justify-between gap-3">
              <h2 className="text-lg font-semibold text-[#173f35]" id={titleId}>{previewItem.product_name}</h2>
              <button className="inline-flex min-h-11 min-w-11 items-center justify-center font-semibold text-[#173f35]" onClick={() => setPreview(null)} type="button">Close</button>
            </div>
            <div className="relative mt-3 aspect-square overflow-hidden rounded-xl bg-[#eadfce]">
              <Image alt={previewItem.product_name} className="object-contain" fill sizes="90vw" src={previewSrc} unoptimized />
            </div>
            {rows.length > 1 ? (
              <div className="mt-3 flex justify-between gap-2">
                <button className="min-h-11 rounded-xl border border-[#173f35]/20 px-4 text-sm font-semibold text-[#173f35]" onClick={() => setPreview((value) => (value == null ? 0 : (value + rows.length - 1) % rows.length))} type="button">Previous product</button>
                <button className="min-h-11 rounded-xl border border-[#173f35]/20 px-4 text-sm font-semibold text-[#173f35]" onClick={() => setPreview((value) => (value == null ? 0 : (value + 1) % rows.length))} type="button">Next product</button>
              </div>
            ) : null}
          </div>
        </div>
      ) : null}
    </section>
  );
}
