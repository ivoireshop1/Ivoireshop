import { saveOrderShipment } from "@/src/lib/delivery/actions";
import { isCarrierOrder, shippingOpsStatus } from "@/src/lib/delivery/tracking";
import { nextOrderStatuses } from "@/src/lib/orders/status";

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
  if (!isCarrierOrder(order.fulfillment_provider)) return null;
  const ops = shippingOpsStatus(order);
  const canShip = nextOrderStatuses(order.status, order.fulfillment_method, order.fulfillment_provider).includes("shipped") || order.status === "shipped";
  const carrier = (order.fulfillment_provider ?? "").toUpperCase();
  return (
    <section className="rounded-2xl bg-white p-5">
      <h2 className="font-semibold text-[#173f35]">Shipping</h2>
      <dl className="mt-3 space-y-2 text-sm">
        <div className="flex justify-between gap-4"><dt>Carrier</dt><dd>{carrier}</dd></div>
        <div className="flex justify-between gap-4"><dt>Mode</dt><dd>{order.shipping_mode === "api" ? "API" : "Manual"}</dd></div>
        <div className="flex justify-between gap-4"><dt>Shipping collected</dt><dd>${Number(order.shipping_cost ?? 0).toFixed(2)}</dd></div>
        <div className="flex justify-between gap-4"><dt>Actual postage</dt><dd>{order.postage_cost == null ? "—" : `$${Number(order.postage_cost).toFixed(2)}`}</dd></div>
        <div className="flex justify-between gap-4"><dt>Shipping status</dt><dd className="capitalize">{ops === "missing-tracking" ? "Shipped · missing tracking" : ops?.replace("-", " ") || "Awaiting shipment"}</dd></div>
        {order.shipped_at ? <div className="flex justify-between gap-4"><dt>Ship date</dt><dd>{new Date(order.shipped_at).toLocaleString()}</dd></div> : null}
      </dl>
      <form action={saveOrderShipment} className="mt-4 space-y-3">
        <input name="id" type="hidden" value={order.id} />
        <label className="block text-sm">
          Tracking number
          <input className="mt-2 min-h-11 w-full rounded-xl border border-[#173f35]/15 px-3" defaultValue={order.tracking_number ?? ""} name="tracking_number" required />
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input defaultChecked={canShip} name="mark_shipped" type="checkbox" />
          Mark as Shipped
        </label>
        <label className="block text-sm">
          Actual postage cost (USD)
          <input className="mt-2 min-h-11 w-full rounded-xl border border-[#173f35]/15 px-3" defaultValue={order.postage_cost != null ? String(order.postage_cost) : ""} min="0" name="postage_cost" step="0.01" type="number" />
        </label>
        <p className="text-xs text-[#6b6b6b]">Actual postage never changes the shipping amount collected from the customer.</p>
        <button className="min-h-11 rounded-xl bg-[#173f35] px-4 py-2 text-sm text-white" type="submit">Save tracking</button>
      </form>
    </section>
  );
}
