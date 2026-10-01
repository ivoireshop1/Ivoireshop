export function fulfillmentDisplay(order: {
  fulfillment_method?: string | null;
  fulfillment_provider?: string | null;
  fulfillment_service?: string | null;
}) {
  if (order.fulfillment_method === "local_pickup") return "Pickup · Store Pickup";
  const provider = (order.fulfillment_provider ?? "").toLowerCase();
  const service = order.fulfillment_service?.trim();
  if (provider === "doordash") return service ? `Local Delivery · DoorDash · ${service}` : "Local Delivery · DoorDash";
  if (provider === "ups") return "Shipping · UPS — Manual Shipping";
  if (provider === "usps") return "Shipping · USPS — Manual Shipping";
  if (provider === "store") return "Delivery · Arranged by Ivoire Shop";
  return order.fulfillment_method === "delivery" ? "Delivery" : "Fulfillment";
}

export function shippingMethodCopy(option: {
  provider: string;
  amount: number;
  mode?: string | null;
}) {
  const price = option.amount <= 0 ? "FREE" : `$${Number(option.amount).toFixed(2)}`;
  if (option.provider === "pickup") {
    return { title: "Store Pickup", subtitle: "Pick up at our location", price };
  }
  if (option.provider === "store") {
    return { title: "Local Delivery", subtitle: "Delivered by Ivoire Shop (Local Area)", price };
  }
  if (option.provider === "doordash") {
    return { title: "Local Delivery", subtitle: "Delivered by DoorDash", price };
  }
  if (option.provider === "usps") {
    return { title: "USPS Shipping", subtitle: "Estimated shipping", price };
  }
  if (option.provider === "ups") {
    return { title: "UPS Shipping", subtitle: "Estimated shipping", price };
  }
  return { title: "Shipping", subtitle: option.mode === "manual" ? "Ivoire Shop shipping charge" : "Delivery", price };
}

export function shippingSummaryLabel(provider?: string | null) {
  const value = (provider ?? "").toLowerCase();
  if (value === "usps") return "Shipping (USPS)";
  if (value === "ups") return "Shipping (UPS)";
  if (value === "pickup") return "Shipping (Pickup)";
  if (value === "store" || value === "doordash") return "Shipping (Local Delivery)";
  return "Shipping";
}
