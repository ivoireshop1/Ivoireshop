"use client";

import { updateOrderStatus } from "@/src/lib/catalog/actions";
import { nextOrderActionLabel, nextOrderStatuses, orderStatusLabel } from "@/src/lib/orders/status";
import { fulfillmentKindLabel, paymentHeaderLabel } from "@/src/lib/orders/ops";
import { isCarrierFulfillment } from "@/src/lib/orders/timeline";
import { formatStoreDateTime } from "@/src/lib/store/timezone";
import { useLiveNotifications } from "@/src/components/realtime/live-notifications-provider";
import { useState, useTransition } from "react";

export function AdminOrderControlHeader({
  order,
}: {
  order: {
    id: string;
    order_number: string;
    status: string;
    created_at: string;
    customer_name: string | null;
    fulfillment_method: string;
    fulfillment_provider?: string | null;
    payment_status: string;
    payment_provider?: string | null;
    tracking_number?: string | null;
    total: number | string;
  };
}) {
  const live = useLiveNotifications();
  const [status, setStatus] = useState(order.status);
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [, startTransition] = useTransition();
  const next = nextOrderStatuses(status, order.fulfillment_method, order.fulfillment_provider).filter((value) => value !== "cancelled");
  const unpaid = order.payment_provider === "stripe" && order.payment_status !== "paid" && order.payment_status !== "partially_refunded";
  const primary = unpaid ? undefined : next[0];

  function run(nextStatus: string) {
    if (busy) return;
    const previous = status;
    setBusy(true);
    setSaved(false);
    setError(null);
    const formData = new FormData();
    formData.set("id", order.id);
    formData.set("expected_status", previous);
    formData.set("status", nextStatus);
    startTransition(async () => {
      const result = await updateOrderStatus(null, formData);
      setBusy(false);
      if (result.error || !result.saved) {
        setStatus(previous);
        setError(result.error || "Status could not be updated.");
        return;
      }
      setStatus(result.status || nextStatus);
      setSaved(true);
      live.bumpLiveOrder(order.id);
    });
  }

  return (
    <section className="rounded-2xl border border-[#173f35]/10 bg-white p-5">
      <div className="flex min-w-0 flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[11px] uppercase tracking-[0.2em] text-[#b8964c]">Order</p>
          <h1 className="mt-1 break-words text-3xl font-semibold text-[#173f35]">{order.order_number}</h1>
        </div>
        <span className="rounded-full bg-[#173f35] px-3 py-1 text-xs font-semibold uppercase tracking-wide text-white">
          {orderStatusLabel(status, order.fulfillment_method, order.fulfillment_provider)}
        </span>
      </div>
      <dl className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <div><dt className="text-[11px] uppercase tracking-[0.16em] text-[#6b6b6b]">Placed</dt><dd className="mt-1 text-sm text-[#173f35]">{formatStoreDateTime(order.created_at)}</dd></div>
        <div><dt className="text-[11px] uppercase tracking-[0.16em] text-[#6b6b6b]">Customer</dt><dd className="mt-1 break-words text-sm text-[#173f35]">{order.customer_name || "Customer"}</dd></div>
        <div><dt className="text-[11px] uppercase tracking-[0.16em] text-[#6b6b6b]">Fulfillment</dt><dd className="mt-1 text-sm text-[#173f35]">{fulfillmentKindLabel(order.fulfillment_method, order.fulfillment_provider)}</dd></div>
        <div><dt className="text-[11px] uppercase tracking-[0.16em] text-[#6b6b6b]">Payment</dt><dd className="mt-1 text-sm text-[#173f35]">{paymentHeaderLabel(order.payment_status, order.payment_provider)}</dd></div>
        <div><dt className="text-[11px] uppercase tracking-[0.16em] text-[#6b6b6b]">Total</dt><dd className="mt-1 text-sm font-semibold tabular-nums text-[#173f35]">${Number(order.total).toFixed(2)}</dd></div>
      </dl>
      {unpaid ? (
        <p className="mt-5 text-sm font-semibold text-[#7c5d1a]">Collect Stripe payment before fulfillment.</p>
      ) : primary ? (
        <button
          className="mt-5 inline-flex min-h-12 w-full items-center justify-center rounded-2xl bg-[#173f35] px-5 text-base font-semibold text-white sm:w-auto"
          disabled={busy}
          onClick={() => run(primary)}
          type="button"
        >
          {busy ? "Saving…" : nextOrderActionLabel(primary, order.fulfillment_method, order.fulfillment_provider)}
        </button>
      ) : isCarrierFulfillment(order.fulfillment_provider) && status === "ready_for_delivery" && !order.tracking_number ? (
        <p className="mt-5 text-sm font-semibold text-[#173f35]">Next: enter the carrier tracking number in Package Shipment.</p>
      ) : (
        <p className="mt-5 text-sm text-[#6b6b6b]">No further fulfillment action on this order.</p>
      )}
      {error ? <p className="mt-3 rounded-xl bg-red-50 p-3 text-sm text-red-800">{error}</p> : null}
      {saved && !error ? <p className="mt-3 text-sm font-semibold text-[#173f35]">Updated ✓</p> : null}
    </section>
  );
}
