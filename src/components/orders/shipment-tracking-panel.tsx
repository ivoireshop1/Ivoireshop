import { carrierDisplayName, isCarrierOrder, officialTrackLabel, trackingUrl } from "@/src/lib/delivery/tracking";
import { formatStoreDate } from "@/src/lib/store/timezone";

export function ShipmentTrackingPanel({
  order,
}: {
  order: {
    fulfillment_method?: string | null;
    fulfillment_provider?: string | null;
    fulfillment_service?: string | null;
    tracking_number?: string | null;
    shipped_at?: string | null;
    status?: string | null;
  };
}) {
  if (!isCarrierOrder(order.fulfillment_provider)) return null;
  const tracking = order.tracking_number?.trim();
  if (!tracking) return null;
  const provider = order.fulfillment_provider ?? "";
  const href = trackingUrl(provider, tracking);
  const carrier = carrierDisplayName(provider);
  return (
    <section className="mt-6 rounded-2xl border border-gold/40 bg-white p-5">
      <h2 className="text-xl font-semibold text-forest-green">Track Your Package</h2>
      <p className="mt-2 text-lg font-semibold text-forest-green">{carrier}</p>
      <p className="mt-2 text-sm text-muted">Tracking number</p>
      <p className="mt-1 break-all font-mono text-sm text-forest-green">{tracking}</p>
      {order.shipped_at ? <p className="mt-1 text-sm text-muted">Shipped {formatStoreDate(order.shipped_at)}</p> : null}
      {href ? (
        <a className="mt-4 inline-flex min-h-11 items-center rounded-lg bg-forest-green px-4 py-2 text-sm font-semibold text-white" href={href} rel="noreferrer" target="_blank">
          {officialTrackLabel(provider)}
        </a>
      ) : null}
    </section>
  );
}
