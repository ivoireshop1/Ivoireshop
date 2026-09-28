export const notificationEvents = [
  "order_confirmed",
  "preparing",
  "ready_for_pickup",
  "out_for_delivery",
  "completed",
  "cancelled",
  "payment_pending",
  "payment_received",
  "payment_failed",
] as const;

export type NotificationEvent = (typeof notificationEvents)[number];

export function notificationEventFromOrderStatus(status: string): NotificationEvent | null {
  if (status === "pending" || status === "confirmed") return "order_confirmed";
  if (status === "processing") return "preparing";
  if (status === "ready_for_pickup") return "ready_for_pickup";
  if (status === "shipped") return "out_for_delivery";
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
  if (eventType === "out_for_delivery") return "→";
  return "•";
}
