function isCarrierFulfillment(provider?: string | null) {
  const value = (provider ?? "").toLowerCase();
  return value === "ups" || value === "usps";
}

export const orderStatuses = ["pending", "confirmed", "processing", "ready_for_pickup", "ready_for_delivery", "shipped", "delivered", "cancelled"] as const;

export function nextOrderStatuses(status: string, fulfillment: string, provider?: string | null): string[] {
  switch (status) {
    case "pending": return ["confirmed", "cancelled"];
    case "confirmed": return ["processing", "cancelled"];
    case "processing":
      if (fulfillment === "local_pickup") return ["ready_for_pickup", "cancelled"];
      if (fulfillment === "delivery" && isCarrierFulfillment(provider)) return ["ready_for_delivery", "cancelled"];
      if (fulfillment === "delivery") return ["ready_for_delivery", "cancelled"];
      return [];
    case "ready_for_pickup": return fulfillment === "local_pickup" ? ["delivered", "cancelled"] : [];
    case "ready_for_delivery":
      if (fulfillment === "delivery" && isCarrierFulfillment(provider)) return ["cancelled"];
      return fulfillment === "delivery" ? ["shipped", "cancelled"] : [];
    case "shipped":
      if (isCarrierFulfillment(provider)) return [];
      return fulfillment === "delivery" ? ["delivered"] : [];
    default: return [];
  }
}

export function orderStatusLabel(status: string, fulfillment: string, provider?: string | null) {
  if (status === "pending") return "New Order";
  if (status === "confirmed") return "Accepted";
  if (status === "processing") return "Preparing";
  if (status === "ready_for_pickup") return "Ready for Pickup";
  if (status === "ready_for_delivery") return isCarrierFulfillment(provider) ? "Awaiting Carrier Drop-Off" : "Ready for Delivery";
  if (status === "shipped") return isCarrierFulfillment(provider) || fulfillment !== "delivery" ? "Shipped" : "Out for Delivery";
  if (status === "delivered") return fulfillment === "local_pickup" ? "Picked Up" : "Delivered";
  if (status === "cancelled") return "Cancelled";
  return status.replaceAll("_", " ");
}

export function nextOrderActionLabel(status: string, fulfillment: string, provider?: string | null) {
  if (status === "confirmed") return "Accept Order";
  if (status === "processing") return "Start Preparing";
  if (status === "ready_for_pickup") return "Ready for Pickup";
  if (status === "ready_for_delivery") return isCarrierFulfillment(provider) ? "Ready for Carrier" : "Ready for Delivery";
  if (status === "shipped") return isCarrierFulfillment(provider) ? "Save Tracking & Mark Shipped" : "Out for Delivery";
  if (status === "delivered") return fulfillment === "local_pickup" ? "Mark Picked Up" : "Mark Delivered";
  if (status === "cancelled") return "Cancel Order";
  return orderStatusLabel(status, fulfillment, provider);
}

export function paymentStatusLabel(status: string, provider?: string | null) {
  if (status === "paid") return "Payment received";
  if (status === "failed") return "Payment failed";
  if (status === "cancelled") return "Payment cancelled";
  if (status === "refunded") return "Refunded";
  if (status === "pending" && provider) return "Payment processing";
  return "Payment pending";
}

export function paymentProviderLabel(provider?: string | null, method?: string | null) {
  if (provider === "square" || method === "square") return "Square";
  if (provider === "paypal" || method === "paypal") return "PayPal";
  if (!method || method === "not_collected") return "To be collected";
  return method.replaceAll("_", " ");
}
