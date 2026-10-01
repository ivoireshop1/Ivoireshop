export function normalizeTracking(value: string) {
  return value.toUpperCase().replace(/[\s-]/g, "");
}

export function looksLikeUpsTracking(raw: string) {
  const value = normalizeTracking(raw);
  if (value.length < 8 || value.length > 34) return false;
  if (/^1Z[0-9A-Z]{16}$/.test(value)) return true;
  if (/^\d{11,34}$/.test(value)) return true;
  if (/^[A-Z0-9]{9,34}$/.test(value)) return true;
  return false;
}

export function looksLikeUspsTracking(raw: string) {
  const value = normalizeTracking(raw);
  if (value.length < 10 || value.length > 34) return false;
  if (/^\d{20,34}$/.test(value)) return true;
  if (/^[A-Z]{2}\d{9}[A-Z]{2}$/.test(value)) return true;
  if (/^420\d{5,11}\d{20,22}$/.test(value)) return true;
  if (/^[A-Z0-9]{10,34}$/.test(value) && /\d/.test(value)) return true;
  return false;
}

export function validateCarrierTracking(provider: string, raw: string) {
  const value = normalizeTracking(raw);
  if (!value) return { ok: false as const, error: "Enter the carrier tracking number from the receipt or label." };
  const carrier = provider.toLowerCase();
  if (carrier === "ups" && !looksLikeUpsTracking(value)) {
    return { ok: false as const, error: "That does not look like a UPS tracking number. Check the receipt or label and try again." };
  }
  if (carrier === "usps" && !looksLikeUspsTracking(value)) {
    return { ok: false as const, error: "That does not look like a USPS tracking number. Check the receipt or label and try again." };
  }
  if (carrier !== "ups" && carrier !== "usps" && (value.length < 8 || value.length > 40)) {
    return { ok: false as const, error: "Enter a tracking number from the carrier." };
  }
  return { ok: true as const, tracking: value };
}

export function trackingUrl(provider: string, tracking: string) {
  const value = encodeURIComponent(normalizeTracking(tracking));
  const carrier = provider.toLowerCase();
  if (carrier === "ups") return `https://www.ups.com/track?tracknum=${value}`;
  if (carrier === "usps") return `https://tools.usps.com/go/TrackConfirmAction?tLabels=${value}`;
  return "";
}

export function isCarrierOrder(provider?: string | null) {
  const value = (provider ?? "").toLowerCase();
  return value === "ups" || value === "usps";
}

export function shippingOpsStatus(order: {
  fulfillment_provider?: string | null;
  status?: string | null;
  tracking_number?: string | null;
  shipped_at?: string | null;
}) {
  if (!isCarrierOrder(order.fulfillment_provider)) return null;
  if (order.status === "cancelled") return "cancelled";
  if (order.status === "delivered") return "delivered";
  if (order.status === "shipped" || order.shipped_at) return order.tracking_number ? "shipped" : "missing-tracking";
  return order.tracking_number ? "awaiting-shipment" : "awaiting-shipment";
}
