import { trackingUrl } from "@/src/lib/delivery/tracking";
import { fulfillmentDisplay } from "@/src/lib/delivery/labels";

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
  const provider = (order.fulfillment_provider ?? "").toLowerCase();
  const tracking = order.tracking_number?.trim();
  if (!tracking) return null;
  const href = trackingUrl(provider, tracking);
  const carrier = provider === "ups" ? "UPS" : provider === "usps" ? "USPS" : fulfillmentDisplay(order);
  return (
    <section className="mt-6 rounded-2xl border border-gold/40 bg-white p-5">
      <h2 className="text-xl font-semibold text-forest-green">Your order has shipped 🎉</h2>
      <p className="mt-2 text-sm text-muted">Carrier: {carrier}</p>
      <p className="mt-1 break-all text-sm">Tracking Number: {tracking}</p>
      {order.shipped_at ? <p className="mt-1 text-sm text-muted">Shipped {new Date(order.shipped_at).toLocaleDateString()}</p> : null}
      {href ? (
        <a className="mt-4 inline-flex min-h-11 items-center rounded-lg bg-forest-green px-4 py-2 text-sm font-semibold text-white" href={href} rel="noreferrer" target="_blank">
          Track Package
        </a>
      ) : null}
    </section>
  );
}
