export function fulfillmentDisplay(order: {
  fulfillment_method?: string | null;
  fulfillment_provider?: string | null;
  fulfillment_service?: string | null;
}) {
  if (order.fulfillment_method === "local_pickup") return "Pickup · Store Pickup";
  const provider = (order.fulfillment_provider ?? "").toLowerCase();
  const service = order.fulfillment_service?.trim();
  if (provider === "doordash") return service ? `Local Delivery · DoorDash · ${service}` : "Local Delivery · DoorDash";
  if (provider === "ivoire") return "Shipping · Ivoire Shop (store-calculated)";
  if (provider === "ups") return service ? `Shipping · UPS · ${service}` : "Shipping · UPS";
  if (provider === "usps") return service ? `Shipping · USPS · ${service}` : "Shipping · USPS";
  if (provider === "store") return "Delivery · Arranged by Ivoire Shop";
  return order.fulfillment_method === "delivery" ? "Delivery" : "Fulfillment";
}

export function shippingMethodCopy(option: {
  provider: string;
  amount: number;
  mode?: string | null;
  estimate?: string | null;
  rateMode?: string | null;
}) {
  const price = option.amount <= 0 ? "FREE" : `$${Number(option.amount).toFixed(2)}`;
  if (option.provider === "pickup") {
    return { title: "Store Pickup", subtitle: "Pick up at our location", price };
  }
  if (option.provider === "store") {
    return { title: "Local Delivery", subtitle: "Delivered by Ivoire Shop (Local Area)", price: option.amount <= 0 ? "$0.00" : price };
  }
  if (option.provider === "doordash") {
    return { title: "Local Delivery", subtitle: "Delivered by DoorDash", price };
  }
  if (option.provider === "ivoire") {
    return { title: "Ivoire Shop Shipping", subtitle: option.estimate || "Store-calculated shipping charge. This is not a live UPS or USPS quote.", price };
  }
  if (option.provider === "usps" || option.provider === "ups") {
    const carrier = option.provider === "usps" ? "USPS" : "UPS";
    const live = option.rateMode === "live_api" || option.mode === "api";
    return {
      title: `${carrier} ${"serviceCode" in option && option.serviceCode ? `· ${option.serviceCode}` : "Shipping"}`,
      subtitle: option.estimate || (live ? "Shippo carrier rate" : option.rateMode === "manual_quote" ? "Ivoire Shop shipping charge" : "Estimated shipping"),
      price,
    };
  }
  return { title: "Shipping", subtitle: option.mode === "manual" ? "Ivoire Shop shipping charge" : "Delivery", price };
}

export function shippingSummaryLabel(provider?: string | null) {
  const value = (provider ?? "").toLowerCase();
  if (value === "ivoire") return "Shipping (store-calculated)";
  if (value === "usps") return "Shipping (USPS)";
  if (value === "ups") return "Shipping (UPS)";
  if (value === "pickup") return "Shipping (Pickup)";
  if (value === "store" || value === "doordash") return "Shipping (Local Delivery)";
  return "Shipping";
}
