"use client";

import { useActionState, useEffect, useState } from "react";
import { useFormStatus } from "react-dom";
import { saveOrderShipment, type ShipmentActionState } from "@/src/lib/delivery/actions";
import { carrierDisplayName, isCarrierOrder, shippingOpsStatus } from "@/src/lib/delivery/tracking";
import { formatStoreDateTime } from "@/src/lib/store/timezone";
import { useLiveNotifications } from "@/src/components/realtime/live-notifications-provider";

function SubmitButton({ label, success }: { label: string; success?: boolean }) {
  const { pending } = useFormStatus();
  return (
    <button className="min-h-11 rounded-xl bg-[#173f35] px-4 py-2 text-sm text-white" disabled={pending} type="submit">
      {pending ? "Saving…" : success ? "Tracking saved ✓" : label}
    </button>
  );
}

function toDatetimeLocal(value?: string | null) {
  const date = value ? new Date(value) : new Date();
  if (Number.isNaN(date.getTime())) return "";
  const offset = date.getTimezoneOffset();
  const local = new Date(date.getTime() - offset * 60_000);
  return local.toISOString().slice(0, 16);
}

export function AdminOrderShipmentForm({
  order,
}: {
  order: {
    id: string;
    status: string;
    fulfillment_method: string;
    fulfillment_provider?: string | null;
    shipping_mode?: string | null;
    shipping_cost?: number | string | null;
    postage_cost?: number | string | null;
    tracking_number?: string | null;
    shipped_at?: string | null;
  };
}) {
  const [state, action] = useActionState(saveOrderShipment, null as ShipmentActionState | null);
  const [editing, setEditing] = useState(!order.tracking_number);
  const live = useLiveNotifications();
  useEffect(() => {
    if (state?.saved) live.bumpLiveOrder(order.id);
  }, [state?.saved, live, order.id]);
  if (!isCarrierOrder(order.fulfillment_provider)) return null;
  const ops = shippingOpsStatus(order);
  const carrier = carrierDisplayName(order.fulfillment_provider);
  const locked = Boolean(order.tracking_number) && !editing;
  const correction = Boolean(order.tracking_number);
  return (
    <section className="rounded-2xl bg-white p-5">
      <h2 className="font-semibold text-[#173f35]">Package Shipment</h2>
      <dl className="mt-3 space-y-2 text-sm">
        <div className="flex justify-between gap-4"><dt>Carrier</dt><dd>{carrier}</dd></div>
        <div className="flex justify-between gap-4"><dt>Mode</dt><dd>{order.shipping_mode === "api" ? "API" : "Manual"}</dd></div>
        <div className="flex justify-between gap-4"><dt>Shipping collected</dt><dd>${Number(order.shipping_cost ?? 0).toFixed(2)}</dd></div>
        <div className="flex justify-between gap-4"><dt>Actual postage</dt><dd>{order.postage_cost == null ? "—" : `$${Number(order.postage_cost).toFixed(2)}`}</dd></div>
        <div className="flex justify-between gap-4"><dt>Shipping status</dt><dd>{ops === "missing-tracking" ? "Shipped · missing tracking" : ops === "awaiting-shipment" ? "Awaiting shipment" : ops?.replace("-", " ") || "Awaiting shipment"}</dd></div>
        {order.shipped_at ? <div className="flex justify-between gap-4"><dt>Ship date</dt><dd>{formatStoreDateTime(order.shipped_at)}</dd></div> : null}
      </dl>
      {locked ? (
        <div className="mt-4 space-y-3">
          <p className="break-all font-mono text-sm text-[#173f35]">{order.tracking_number}</p>
          <button className="min-h-11 rounded-xl border border-[#173f35]/20 px-4 text-sm font-semibold text-[#173f35]" onClick={() => setEditing(true)} type="button">
            Edit Tracking
          </button>
        </div>
      ) : (
        <form action={action} className="mt-4 space-y-3">
          <input name="id" type="hidden" value={order.id} />
          {correction ? <input name="mode" type="hidden" value="correction" /> : null}
          <label className="block text-sm">
            Tracking Number
            <input
              className="mt-2 min-h-11 w-full rounded-xl border border-[#173f35]/15 px-3"
              defaultValue={order.tracking_number ?? ""}
              name="tracking_number"
              placeholder={carrier === "UPS" ? "1Z…" : "94…"}
              required
            />
          </label>
          <label className="block text-sm">
            Actual Postage Cost
            <input className="mt-2 min-h-11 w-full rounded-xl border border-[#173f35]/15 px-3" defaultValue={order.postage_cost != null ? String(order.postage_cost) : ""} min="0" name="postage_cost" step="0.01" type="number" />
          </label>
          {!order.shipped_at ? (
            <label className="block text-sm">
              Shipment Date
              <input className="mt-2 min-h-11 w-full rounded-xl border border-[#173f35]/15 px-3" defaultValue={toDatetimeLocal()} name="shipped_at" type="datetime-local" />
            </label>
          ) : null}
          <p className="text-xs text-[#6b6b6b]">Enter the tracking number from UPS/USPS. Actual postage never changes the shipping amount collected from the customer.</p>
          {state?.error ? <p className="rounded-xl bg-red-50 p-3 text-sm text-red-800">{state.error}</p> : null}
          {state?.saved ? (
            <p className="rounded-xl bg-[#173f35]/5 p-3 text-sm text-[#173f35]">
              {state.corrected
                ? "Tracking information updated. Customer notified."
                : state.markedShipped
                  ? "Package marked as shipped. Customer notified."
                  : "Tracking saved ✓ Customer notified."}
            </p>
          ) : null}
          <SubmitButton label={correction ? "Save Correction" : "Save Tracking & Mark Shipped"} success={state?.saved} />
        </form>
      )}
    </section>
  );
}
