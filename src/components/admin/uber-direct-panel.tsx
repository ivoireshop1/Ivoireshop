"use client";

import { useActionState } from "react";
import { cancelUberOrderDelivery, checkUberDirectConnection, saveUberDirectSettings } from "@/src/lib/delivery/uber-actions";

type DeliveryRow = {
  order_id: string;
  delivery_id: string | null;
  status: string | null;
  tracking_url: string | null;
  fee_cents: number | null;
  markup_cents: number | null;
  courier_name: string | null;
  last_error: string | null;
  environment: string | null;
  payment_status?: string | null;
  refunded_amount?: number | null;
};

export function UberDirectPanel({
  enabled,
  showAtCheckout,
  productionDispatch,
  markupCents,
  environment,
  configured,
  dispatchAllowed,
  health,
  deliveries,
}: {
  enabled: boolean;
  showAtCheckout: boolean;
  productionDispatch: boolean;
  markupCents: number;
  environment: string;
  configured: boolean;
  dispatchAllowed: boolean;
  health: string;
  deliveries: DeliveryRow[];
}) {
  const [state, save] = useActionState(saveUberDirectSettings, null);
  return (
    <section className="rounded-2xl bg-white p-5">
      <h2 className="font-semibold text-[#173f35]">Local Delivery / Uber Direct</h2>
      <p className="mt-2 text-sm text-[#6b6b6b]">Environment: {environment}. Connection: {health}. Credentials: {configured ? "present" : "missing"}. Courier booking: {dispatchAllowed ? "allowed for this environment" : "off"}.</p>
      <form action={save} className="mt-4 grid gap-3">
        <label className="flex min-h-11 items-center gap-2 text-sm"><input defaultChecked={enabled} name="uber_direct_enabled" type="checkbox" /> Enable Uber Direct</label>
        <label className="flex min-h-11 items-center gap-2 text-sm"><input defaultChecked={showAtCheckout} name="uber_direct_show_at_checkout" type="checkbox" /> Show local delivery at checkout</label>
        <label className="flex min-h-11 items-center gap-2 text-sm"><input defaultChecked={productionDispatch} name="uber_direct_production_dispatch" type="checkbox" /> Allow production dispatch after the server flag is approved</label>
        <label className="text-sm text-[#173f35]">Separately disclosed markup (cents)
          <input className="mt-1 min-h-11 w-full rounded-xl border border-[#173f35]/20 px-3" defaultValue={markupCents} inputMode="numeric" name="uber_direct_markup_cents" />
        </label>
        <button className="min-h-11 rounded-xl bg-[#173f35] px-4 text-sm font-semibold text-white" type="submit">Save Uber Direct</button>
        {state?.error ? <p className="text-sm text-red-800">{state.error}</p> : null}
        {state?.saved ? <p className="text-sm text-[#173f35]">Saved.</p> : null}
      </form>
      <form action={checkUberDirectConnection} className="mt-3">
        <button className="min-h-11 rounded-xl border border-[#173f35]/20 px-4 text-sm font-semibold text-[#173f35]" type="submit">Check API connection</button>
      </form>
      <div className="mt-5 overflow-x-auto">
        <table className="w-full min-w-[720px] text-left text-sm">
          <thead>
            <tr className="text-[#6b6b6b]">
              <th className="py-2">Status</th>
              <th>Delivery</th>
              <th>Courier</th>
              <th>Fee</th>
              <th>Payment</th>
              <th>Tracking</th>
            </tr>
          </thead>
          <tbody>
            {deliveries.map((row) => (
              <tr className="border-t border-[#173f35]/10" key={row.order_id}>
                <td className="py-2">{row.status || "accepted"}{row.last_error ? ` · ${row.last_error}` : ""}</td>
                <td>{row.delivery_id || "Not booked"} · {row.environment}</td>
                <td>{row.courier_name || "—"}</td>
                <td>{money(row.fee_cents)}{row.markup_cents ? ` + ${money(row.markup_cents)} markup` : ""}</td>
                <td>{row.payment_status || "—"}{row.refunded_amount ? ` · refunded $${Number(row.refunded_amount).toFixed(2)}` : ""}</td>
                <td>{row.tracking_url ? <a className="underline" href={row.tracking_url}>Track</a> : "—"}{row.delivery_id && row.status !== "delivered" && row.status !== "cancelled" ? <button className="ml-3 underline" onClick={() => cancelUberOrderDelivery(row.order_id)} type="button">Cancel</button> : null}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {!deliveries.length ? <p className="mt-3 text-sm text-[#6b6b6b]">No Uber deliveries yet.</p> : null}
      </div>
    </section>
  );
}

function money(cents: number | null) {
  if (cents == null) return "—";
  return `$${(cents / 100).toFixed(2)}`;
}
