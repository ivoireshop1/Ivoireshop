export function isAdminNewOrder(status: string) {
  return status === "pending";
}

export function isAdminInProgressOrder(status: string) {
  return status === "confirmed" || status === "processing" || status === "ready_for_pickup" || status === "ready_for_delivery" || status === "shipped";
}

export function isAdminCompletedOrder(status: string) {
  return status === "delivered";
}

export function isAdminCancelledOrder(status: string) {
  return status === "cancelled";
}

export type AdminOrderView = "new" | "in_progress" | "completed" | "cancelled" | "all";

export function adminOrderView(status: string): Exclude<AdminOrderView, "all"> {
  if (isAdminCancelledOrder(status)) return "cancelled";
  if (isAdminCompletedOrder(status)) return "completed";
  if (isAdminNewOrder(status)) return "new";
  return "in_progress";
}

export function matchesAdminOrderView(status: string, view: AdminOrderView) {
  if (view === "all") return true;
  return adminOrderView(status) === view;
}

export function isCustomerCurrentOrder(status: string, paymentStatus?: string | null) {
  if (status === "delivered" || status === "cancelled") return false;
  if (paymentStatus === "refunded") return false;
  return true;
}

export function formatOrderDate(iso: string) {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: process.env.NEXT_PUBLIC_STORE_TIMEZONE || "America/New_York",
    month: "long",
    day: "numeric",
    year: "numeric",
  }).format(new Date(iso));
}
