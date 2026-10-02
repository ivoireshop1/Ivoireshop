import { startOfStoreDayIso } from "../store/timezone.ts";

function isCarrier(provider?: string | null) {
  const value = (provider ?? "").toLowerCase();
  return value === "ups" || value === "usps";
}

const STATUS_RANK: Record<string, number> = {
  pending: 0,
  confirmed: 1,
  processing: 2,
  ready_for_pickup: 3,
  ready_for_delivery: 3,
  shipped: 4,
  delivered: 5,
  cancelled: -1,
};

export function statusReached(current: string, target: string) {
  if (current === "cancelled") return target === "cancelled" || target === "pending";
  return (STATUS_RANK[current] ?? -1) >= (STATUS_RANK[target] ?? 99);
}

export function fulfillmentKindLabel(fulfillment?: string | null, provider?: string | null) {
  if (fulfillment === "local_pickup") return "Store Pickup";
  const value = (provider ?? "").toLowerCase();
  if (value === "ups") return "UPS";
  if (value === "usps") return "USPS";
  return "Local Delivery";
}

export function paymentHeaderLabel(status?: string | null, provider?: string | null) {
  if (status === "paid") return "Paid";
  if (status === "refunded") return "Refunded";
  if (status === "pending" && provider && provider !== "not_collected") return "Payment Pending";
  return "Unpaid";
}

export function paidAmountDisplay(status?: string | null, total?: number | string | null) {
  if (status === "paid") return Number(total ?? 0);
  return null;
}

export type AttentionState =
  | "Needs Acceptance"
  | "Preparing"
  | "Ready for Pickup"
  | "Ready for Delivery"
  | "Awaiting Tracking"
  | "Out for Delivery"
  | null;

export function orderAttention(order: {
  status: string;
  fulfillment_method?: string | null;
  fulfillment_provider?: string | null;
  tracking_number?: string | null;
}): AttentionState {
  if (order.status === "pending") return "Needs Acceptance";
  if (order.status === "processing") return "Preparing";
  if (order.status === "ready_for_pickup") return "Ready for Pickup";
  const carrier = isCarrier(order.fulfillment_provider);
  if (order.status === "ready_for_delivery" && carrier && !order.tracking_number) return "Awaiting Tracking";
  if (order.status === "ready_for_delivery" && !carrier) return "Ready for Delivery";
  if (order.status === "shipped" && !carrier) return "Out for Delivery";
  return null;
}

export function trackingRequiredMissing(order: {
  status: string;
  fulfillment_provider?: string | null;
  tracking_number?: string | null;
}) {
  return isCarrier(order.fulfillment_provider) && order.status === "ready_for_delivery" && !order.tracking_number;
}

export function pickingProgress(total: number, picked: number) {
  const safeTotal = Math.max(0, total);
  const safePicked = Math.min(Math.max(0, picked), safeTotal);
  const complete = safeTotal > 0 && safePicked === safeTotal;
  return {
    total: safeTotal,
    picked: safePicked,
    complete,
    label: complete ? `${safePicked} of ${safeTotal} items picked ✓` : `${safePicked} of ${safeTotal} items picked`,
  };
}

export function splitProductLabel(name: string) {
  const match = name.trim().match(/^(.*?)\s+(\d+\s?(?:g|kg|lb|oz|ml|l)|small|medium|large|xl)$/i);
  if (match) return { title: match[1], variant: match[2] };
  return { title: name.trim(), variant: null as string | null };
}

export function orderMatchesSearch(
  order: {
    order_number?: string | null;
    customer_name?: string | null;
    customer_email?: string | null;
    customer_phone?: string | null;
    tracking_number?: string | null;
    confirmation_code?: string | null;
  },
  raw: string,
) {
  const needle = raw.trim().toLowerCase();
  if (!needle) return true;
  return [
    order.order_number,
    order.customer_name,
    order.customer_email,
    order.customer_phone,
    order.tracking_number,
    order.confirmation_code,
  ].some((value) => (value ?? "").toLowerCase().includes(needle));
}

export type OpsOrderFilters = {
  view?: string;
  status?: string;
  fulfillment?: string;
  payment?: string;
  carrier?: string;
  date?: string;
  shipping?: string;
  attention?: string;
};

export function orderMatchesOpsFilters(
  order: {
    status: string;
    payment_status?: string | null;
    fulfillment_method?: string | null;
    fulfillment_provider?: string | null;
    tracking_number?: string | null;
    created_at: string;
  },
  filters: OpsOrderFilters,
  now = new Date(),
) {
  if (filters.status && filters.status !== "all" && order.status !== filters.status) return false;
  if (filters.payment && filters.payment !== "all" && order.payment_status !== filters.payment) return false;
  if (filters.fulfillment === "local_pickup" && order.fulfillment_method !== "local_pickup") return false;
  if (filters.fulfillment === "delivery" && order.fulfillment_method !== "delivery") return false;
  const provider = (order.fulfillment_provider ?? "").toLowerCase();
  if (filters.carrier === "ups" && provider !== "ups") return false;
  if (filters.carrier === "usps" && provider !== "usps") return false;
  if (filters.carrier === "local" && (order.fulfillment_method !== "delivery" || provider === "ups" || provider === "usps")) return false;
  if (filters.carrier === "pickup" && order.fulfillment_method !== "local_pickup") return false;
  if (filters.shipping === "missing-tracking") {
    if (!isCarrier(order.fulfillment_provider) || order.tracking_number || order.status === "cancelled") return false;
  }
  if (filters.attention) {
    const wanted: Record<string, AttentionState> = {
      needs_acceptance: "Needs Acceptance",
      preparing: "Preparing",
      ready_pickup: "Ready for Pickup",
      ready_delivery: "Ready for Delivery",
      awaiting_tracking: "Awaiting Tracking",
      out_for_delivery: "Out for Delivery",
    };
    if (orderAttention(order) !== wanted[filters.attention]) return false;
  }
  if (filters.date === "today" || filters.date === "week") {
    const todayStart = new Date(startOfStoreDayIso(now));
    const start = filters.date === "today" ? todayStart : new Date(todayStart.getTime() - 6 * 24 * 60 * 60 * 1000);
    if (new Date(order.created_at) < start) return false;
  }
  return true;
}

export type ChecklistItem = { id: string; label: string; done: boolean };

export function fulfillmentChecklist(order: {
  status: string;
  payment_status?: string | null;
  fulfillment_method?: string | null;
  fulfillment_provider?: string | null;
  tracking_number?: string | null;
}, extra?: { customerNotified?: boolean }) {
  const carrier = isCarrier(order.fulfillment_provider);
  const pickup = order.fulfillment_method === "local_pickup";
  const notified = Boolean(extra?.customerNotified);
  const items: ChecklistItem[] = [
    { id: "received", label: "Order received", done: true },
    { id: "payment", label: "Payment confirmed", done: order.payment_status === "paid" },
    { id: "accepted", label: "Order accepted", done: statusReached(order.status, "confirmed") && order.status !== "pending" },
    { id: "preparing", label: "Preparing", done: statusReached(order.status, "processing") && order.status !== "pending" && order.status !== "confirmed" },
  ];
  if (pickup) {
    items.push({ id: "ready", label: "Ready", done: statusReached(order.status, "ready_for_pickup") && !["pending", "confirmed", "processing"].includes(order.status) });
    items.push({ id: "notified", label: "Customer notified", done: notified || statusReached(order.status, "ready_for_pickup") && !["pending", "confirmed", "processing"].includes(order.status) });
    items.push({ id: "completed", label: "Completed", done: order.status === "delivered" });
  } else if (carrier) {
    items.push({ id: "ready_carrier", label: "Ready for carrier", done: statusReached(order.status, "ready_for_delivery") && !["pending", "confirmed", "processing"].includes(order.status) });
    items.push({ id: "tracking", label: "Tracking entered", done: Boolean(order.tracking_number) });
    items.push({ id: "shipped", label: "Shipped", done: statusReached(order.status, "shipped") && ["shipped", "delivered"].includes(order.status) });
    items.push({ id: "completed", label: "Completed", done: order.status === "delivered" });
  } else {
    items.push({ id: "ready", label: "Ready", done: statusReached(order.status, "ready_for_delivery") && !["pending", "confirmed", "processing"].includes(order.status) });
    items.push({ id: "notified", label: "Customer notified", done: notified || (statusReached(order.status, "ready_for_delivery") && !["pending", "confirmed", "processing"].includes(order.status)) });
    items.push({ id: "completed", label: "Completed", done: order.status === "delivered" });
  }
  return items;
}

export function dashboardFulfillmentCounts(orders: Array<{
  status: string;
  fulfillment_method?: string | null;
  fulfillment_provider?: string | null;
  tracking_number?: string | null;
}>) {
  const counts = {
    needsAcceptance: 0,
    preparing: 0,
    readyPickup: 0,
    readyDelivery: 0,
    awaitingTracking: 0,
    outForDelivery: 0,
  };
  for (const order of orders) {
    const attention = orderAttention(order);
    if (attention === "Needs Acceptance") counts.needsAcceptance += 1;
    if (attention === "Preparing") counts.preparing += 1;
    if (attention === "Ready for Pickup") counts.readyPickup += 1;
    if (attention === "Ready for Delivery") counts.readyDelivery += 1;
    if (attention === "Awaiting Tracking") counts.awaitingTracking += 1;
    if (attention === "Out for Delivery") counts.outForDelivery += 1;
  }
  return counts;
}

export function eventTime(events: Array<{ status: string; created_at: string }>, status: string) {
  return events.find((event) => event.status === status)?.created_at ?? null;
}

export const INTERNAL_NOTES_CUSTOMER_ACCESS = false;
export const ITEM_PICKS_CUSTOMER_ACCESS = false;
