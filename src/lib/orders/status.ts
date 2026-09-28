export const orderStatuses = ["pending", "confirmed", "processing", "ready_for_pickup", "shipped", "delivered", "cancelled"] as const;

export function nextOrderStatuses(status: string, fulfillment: string): string[] {
  switch (status) {
    case "pending": return ["confirmed", "cancelled"];
    case "confirmed": return ["processing", "cancelled"];
    case "processing": return fulfillment === "local_pickup" ? ["ready_for_pickup", "cancelled"] : fulfillment === "delivery" ? ["shipped", "cancelled"] : [];
    case "ready_for_pickup": return fulfillment === "local_pickup" ? ["delivered", "cancelled"] : [];
    case "shipped": return fulfillment === "delivery" ? ["delivered"] : [];
    default: return [];
  }
}

export function orderStatusLabel(status: string, fulfillment: string) {
  if (status === "pending") return "New";
  if (status === "confirmed") return "Confirmed";
  if (status === "processing") return "Preparing";
  if (status === "ready_for_pickup") return "Ready for Pickup";
  if (status === "shipped") return "Out for Delivery";
  if (status === "delivered") return fulfillment === "local_pickup" ? "Completed" : "Completed";
  if (status === "cancelled") return "Cancelled";
  return status.replaceAll("_", " ");
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
