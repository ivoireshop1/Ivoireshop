export const notificationEvents = [
  "order_confirmed",
  "preparing",
  "ready_for_pickup",
  "ready_for_delivery",
  "out_for_delivery",
  "shipped",
  "tracking_added",
  "completed",
  "cancelled",
  "payment_pending",
  "payment_received",
  "payment_failed",
] as const;

export type NotificationEvent = (typeof notificationEvents)[number];

export function notificationEventFromOrderStatus(status: string, provider?: string | null): NotificationEvent | null {
  if (status === "pending" || status === "confirmed") return "order_confirmed";
  if (status === "processing") return "preparing";
  if (status === "ready_for_pickup") return "ready_for_pickup";
  if (status === "ready_for_delivery") return "ready_for_delivery";
  if (status === "shipped") return provider === "ups" || provider === "usps" ? "shipped" : "out_for_delivery";
  if (status === "delivered") return "completed";
  if (status === "cancelled") return "cancelled";
  return null;
}

export function notificationEventFromPaymentStatus(status: string): NotificationEvent | null {
  if (status === "pending") return "payment_pending";
  if (status === "paid") return "payment_received";
  if (status === "failed") return "payment_failed";
  return null;
}

export function notificationIcon(eventType: string) {
  if (eventType === "ready_for_pickup" || eventType === "completed" || eventType === "order_confirmed") return "✓";
  if (eventType === "payment_received") return "$";
  if (eventType === "payment_failed" || eventType === "cancelled") return "!";
  if (eventType === "out_for_delivery" || eventType === "tracking_added") return "→";
  if (eventType === "announcement") return "🌿";
  return "•";
}
