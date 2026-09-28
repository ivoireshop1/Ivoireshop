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
  return status === "delivered" && fulfillment === "local_pickup" ? "Collected" : status.replaceAll("_", " ");
}
