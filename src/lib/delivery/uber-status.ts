export function uberIdempotencyKey(orderId: string) {
  return `ivoire-order-${orderId}`;
}

export function paidUberBookingBlocker(input: {
  paymentStatus: string;
  isDemo: boolean;
  dispatchAllowed: boolean;
  quoteId: string;
  quoteExpiresAt: string | null;
  now: number;
  feeCents: number;
  markupCents: number;
  shippingCost: number;
}) {
  if (input.isDemo || input.paymentStatus !== "paid") return "A courier is booked only after a successful payment.";
  if (!input.dispatchAllowed) return "Uber courier dispatch is off.";
  if (!input.quoteId) return "The paid order has no Uber quote.";
  if (input.quoteExpiresAt && Date.parse(input.quoteExpiresAt) <= input.now) return "The Uber delivery quote expired. No courier was booked.";
  const paidCents = Math.round(input.shippingCost * 100);
  if (!Number.isFinite(input.feeCents) || input.feeCents < 0 || !Number.isFinite(input.markupCents) || paidCents !== input.feeCents + input.markupCents) {
    return "The Uber quote no longer matches the paid delivery fee. No courier was booked.";
  }
  return null;
}

export const UBER_CUSTOMER_STAGES = [
  { id: "accepted", label: "Order accepted" },
  { id: "requested", label: "Courier requested" },
  { id: "assigned", label: "Courier assigned" },
  { id: "approaching", label: "Courier approaching pickup" },
  { id: "picked_up", label: "Order picked up" },
  { id: "en_route", label: "En route" },
  { id: "delivered", label: "Delivered" },
] as const;

export type UberCustomerStage = (typeof UBER_CUSTOMER_STAGES)[number]["id"] | "cancelled" | "failed";

const RANK: Record<string, number> = {
  pending: 1,
  pickup: 2,
  pickup_complete: 3,
  dropoff: 4,
  delivered: 5,
};

export function uberStatusRank(status: string | null | undefined) {
  return RANK[String(status ?? "").toLowerCase()] ?? 0;
}

export function shouldApplyUberStatus(current: string | null | undefined, incoming: string | null | undefined) {
  const next = String(incoming ?? "").toLowerCase();
  if (!next) return false;
  if (next === "canceled" || next === "cancelled" || next === "returned") return true;
  const currentRank = uberStatusRank(current);
  const nextRank = uberStatusRank(next);
  if (!nextRank) return false;
  return nextRank >= currentRank;
}

export function uberCustomerStage(input: { status?: string | null; courierName?: string | null; booked?: boolean }): UberCustomerStage {
  const status = String(input.status ?? "").toLowerCase();
  if (status === "canceled" || status === "cancelled") return "cancelled";
  if (status === "returned") return "failed";
  if (status === "delivered") return "delivered";
  if (status === "dropoff") return "en_route";
  if (status === "pickup_complete") return "picked_up";
  if (status === "pickup" && input.courierName) return "approaching";
  if (status === "pickup") return "assigned";
  if (status === "pending" || input.booked) return "requested";
  return "accepted";
}
