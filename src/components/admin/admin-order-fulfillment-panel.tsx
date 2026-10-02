import { fulfillmentKindLabel, eventTime } from "@/src/lib/orders/ops";
import { orderStatusLabel } from "@/src/lib/orders/status";
import { PickupLocationBlock, pickupLocationForOrder } from "@/src/components/store/pickup-location-block";
import { formatStoreDateTime } from "@/src/lib/store/timezone";
import { isCarrierFulfillment } from "@/src/lib/orders/timeline";
import { officialTrackLabel, trackingUrl } from "@/src/lib/delivery/tracking";

export function AdminOrderFulfillmentPanel({
  order,
  events,
}: {
  order: {
    status: string;
    fulfillment_method: string;
    fulfillment_provider?: string | null;
    tracking_number?: string | null;
    shipped_at?: string | null;
    created_at: string;
    shipping_cost?: number | string | null;
    shipping_address?: {
      address_line_1?: string | null;
      address_line_2?: string | null;
      city?: string | null;
      state?: string | null;
      postal_code?: string | null;
      country?: string | null;
    } | null;
  };
  events: Array<{ status: string; created_at: string }>;
}) {
  const carrier = isCarrierFulfillment(order.fulfillment_provider);
  const accepted = eventTime(events, "confirmed");
  const preparing = eventTime(events, "processing");
  const ready = eventTime(events, order.fulfillment_method === "local_pickup" ? "ready_for_pickup" : "ready_for_delivery");
  const shipped = order.shipped_at || eventTime(events, "shipped");
  const completed = eventTime(events, "delivered");
  return (
    <section className="rounded-2xl bg-white p-5">
      <h2 className="font-semibold text-[#173f35]">Fulfillment</h2>
      <dl className="mt-3 space-y-2 text-sm">
        <div className="flex justify-between gap-4"><dt>Method</dt><dd>{fulfillmentKindLabel(order.fulfillment_method, order.fulfillment_provider)}</dd></div>
        <div className="flex justify-between gap-4"><dt>Status</dt><dd>{orderStatusLabel(order.status, order.fulfillment_method, order.fulfillment_provider)}</dd></div>
        <div className="flex justify-between gap-4"><dt>Shipping charge</dt><dd>${Number(order.shipping_cost ?? 0).toFixed(2)}</dd></div>
        <div className="flex justify-between gap-4"><dt>Created</dt><dd>{formatStoreDateTime(order.created_at)}</dd></div>
        {accepted ? <div className="flex justify-between gap-4"><dt>Accepted</dt><dd>{formatStoreDateTime(accepted)}</dd></div> : null}
        {preparing ? <div className="flex justify-between gap-4"><dt>Preparing</dt><dd>{formatStoreDateTime(preparing)}</dd></div> : null}
        {ready ? <div className="flex justify-between gap-4"><dt>Ready</dt><dd>{formatStoreDateTime(ready)}</dd></div> : null}
        {carrier && order.tracking_number ? (
          <div className="flex justify-between gap-4">
            <dt>Tracking</dt>
            <dd className="break-all text-right">
              {order.tracking_number}
              {trackingUrl(order.fulfillment_provider ?? "", order.tracking_number) ? (
                <>
                  <br />
                  <a className="font-semibold text-[#173f35] underline" href={trackingUrl(order.fulfillment_provider ?? "", order.tracking_number)} rel="noreferrer" target="_blank">
                    {officialTrackLabel(order.fulfillment_provider)}
                  </a>
                </>
              ) : null}
            </dd>
          </div>
        ) : null}
        {shipped ? <div className="flex justify-between gap-4"><dt>Shipped</dt><dd>{formatStoreDateTime(shipped)}</dd></div> : null}
        {completed ? <div className="flex justify-between gap-4"><dt>Completed</dt><dd>{formatStoreDateTime(completed)}</dd></div> : null}
      </dl>
      {order.fulfillment_method === "local_pickup" ? <PickupLocationBlock className="mt-4" location={pickupLocationForOrder(order)} /> : null}
      {order.fulfillment_method === "delivery" ? (
        <address className="mt-4 whitespace-pre-line text-sm not-italic text-[#6b6b6b]">
          {[order.shipping_address?.address_line_1, order.shipping_address?.address_line_2, order.shipping_address?.city, order.shipping_address?.state, order.shipping_address?.postal_code, order.shipping_address?.country].filter(Boolean).join("\n")}
        </address>
      ) : null}
    </section>
  );
}
