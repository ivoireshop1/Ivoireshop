"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { updateOrderStatus, type OrderStatusActionState } from "@/src/lib/catalog/actions";
import { nextOrderActionLabel, nextOrderStatuses, orderStatusLabel, paymentProviderLabel, paymentStatusLabel } from "@/src/lib/orders/status";
import { isCarrierFulfillment } from "@/src/lib/orders/timeline";
import { fulfillmentDisplay } from "@/src/lib/delivery/labels";
import { PickupLocationBlock, pickupLocationForOrder } from "@/src/components/store/pickup-location-block";

function ActionSubmit({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <button className="min-h-11 rounded-xl bg-[#173f35] px-4 py-2 text-sm text-white disabled:cursor-not-allowed disabled:opacity-50" disabled={pending} type="submit">
      {pending ? "Saving…" : label}
    </button>
  );
}

export function AdminOrderFulfillmentActions({
  order,
}: {
  order: {
    id: string;
    status: string;
    fulfillment_method: string;
    fulfillment_provider?: string | null;
    fulfillment_service?: string | null;
    payment_status: string;
    payment_provider?: string | null;
    payment_method?: string | null;
    provider_payment_id?: string | null;
    provider_order_id?: string | null;
    shipping_address?: {
      address_line_1?: string | null;
      address_line_2?: string | null;
      city?: string | null;
      state?: string | null;
      postal_code?: string | null;
      country?: string | null;
    } | null;
  };
}) {
  const [state, action] = useActionState(updateOrderStatus, null as OrderStatusActionState | null);
  const next = nextOrderStatuses(order.status, order.fulfillment_method, order.fulfillment_provider);
  const primary = next.filter((status) => status !== "cancelled");
  const canCancel = next.includes("cancelled");
  const carrier = isCarrierFulfillment(order.fulfillment_provider);

  return (
    <section className="rounded-2xl bg-white p-5">
      <h2 className="font-semibold text-[#173f35]">Fulfillment</h2>
      <p className="mt-3 text-sm">{fulfillmentDisplay(order)}</p>
      <p className="mt-2 text-sm font-semibold text-[#173f35]">
        {orderStatusLabel(order.status, order.fulfillment_method, order.fulfillment_provider)}
      </p>
      {order.fulfillment_method === "local_pickup" ? (
        <PickupLocationBlock className="mt-3" location={pickupLocationForOrder(order)} />
      ) : null}
      {order.fulfillment_service && order.fulfillment_provider ? (
        <p className="mt-2 break-words text-sm text-[#6b6b6b]">Service snapshot: {order.fulfillment_service}</p>
      ) : null}
      {order.fulfillment_method === "delivery" && (
        <address className="mt-3 whitespace-pre-line text-sm not-italic text-[#6b6b6b]">
          {[order.shipping_address?.address_line_1, order.shipping_address?.address_line_2, order.shipping_address?.city, order.shipping_address?.state, order.shipping_address?.postal_code, order.shipping_address?.country].filter(Boolean).join("\n")}
        </address>
      )}
      <p className="mt-4 text-sm">Payment: {paymentStatusLabel(order.payment_status, order.payment_provider)}</p>
      <p className="mt-1 text-sm text-[#6b6b6b]">Provider: {paymentProviderLabel(order.payment_provider, order.payment_method)}</p>
      {order.provider_payment_id ? <p className="mt-2 break-all text-xs text-[#6b6b6b]">Provider payment ID: {order.provider_payment_id}</p> : null}
      {order.provider_order_id ? <p className="mt-1 break-all text-xs text-[#6b6b6b]">Provider order ID: {order.provider_order_id}</p> : null}
      {carrier && (order.status === "ready_for_delivery" || order.status === "processing") ? (
        <p className="mt-4 text-sm text-[#173f35]">After the carrier accepts the package, enter the real tracking number in Package Shipment.</p>
      ) : null}
      <div className="mt-4 flex flex-wrap gap-2">
        {primary.map((status) => (
          <form action={action} key={status}>
            <input name="id" type="hidden" value={order.id} />
            <input name="expected_status" type="hidden" value={order.status} />
            <input name="status" type="hidden" value={status} />
            <ActionSubmit label={nextOrderActionLabel(status, order.fulfillment_method, order.fulfillment_provider)} />
          </form>
        ))}
        {canCancel ? (
          <form action={action}>
            <input name="id" type="hidden" value={order.id} />
            <input name="expected_status" type="hidden" value={order.status} />
            <input name="status" type="hidden" value="cancelled" />
            <CancelSubmit />
          </form>
        ) : null}
      </div>
      {state?.error ? <p className="mt-3 rounded-xl bg-red-50 p-3 text-sm text-red-800">{state.error}</p> : null}
      {state?.saved ? <p className="mt-3 rounded-xl bg-[#173f35]/5 p-3 text-sm text-[#173f35]">Updated ✓</p> : null}
      {canCancel ? <p className="mt-2 text-sm text-muted">Cancellation does not issue a refund or automatically restock inventory.</p> : null}
    </section>
  );
}

function CancelSubmit() {
  const { pending } = useFormStatus();
  return (
    <button className="min-h-11 rounded-xl border border-[#173f35]/20 px-4 py-2 text-sm font-semibold text-[#173f35]" disabled={pending} type="submit">
      {pending ? "Saving…" : "Cancel Order"}
    </button>
  );
}
