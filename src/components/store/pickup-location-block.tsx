import { formatOriginLines, originFromSettings, pickupLocationFromUnknown, type PickupLocationSnapshot, type StoreOrigin } from "@/src/lib/delivery/origin";

export function PickupLocationBlock({
  location,
  className = "",
}: {
  location: StoreOrigin | PickupLocationSnapshot | null | undefined;
  className?: string;
}) {
  const lines = formatOriginLines(location ?? undefined);
  if (!lines.length) return null;
  return (
    <div className={className}>
      <p className="font-semibold text-forest-green">Pickup Location</p>
      {location && "name" in location && location.name ? <p className="mt-1 text-sm text-forest-green">{location.name}</p> : null}
      <address className="mt-1 whitespace-pre-line not-italic text-sm text-muted">{lines.join("\n")}</address>
    </div>
  );
}

export function pickupLocationForOrder(order: {
  fulfillment_method?: string | null;
  shipping_address?: unknown;
  delivery_snapshot?: unknown;
  storeOrigin?: StoreOrigin | null;
}) {
  if (order.fulfillment_method !== "local_pickup") return null;
  return (
    pickupLocationFromUnknown(order.shipping_address) ||
    pickupLocationFromUnknown(order.delivery_snapshot) ||
    (order.storeOrigin && formatOriginLines(order.storeOrigin).length ? order.storeOrigin : null)
  );
}

export function originFromSettingsRow(row: Record<string, unknown> | null | undefined) {
  return originFromSettings(row);
}
