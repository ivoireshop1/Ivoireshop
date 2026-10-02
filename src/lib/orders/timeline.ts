export function isCarrierFulfillment(provider?: string | null) {
  const value = (provider ?? "").toLowerCase();
  return value === "ups" || value === "usps";
}

export function isLocalDelivery(fulfillment: string, provider?: string | null) {
  return fulfillment === "delivery" && !isCarrierFulfillment(provider);
}

export type TimelineStepId = "placed" | "accepted" | "preparing" | "ready" | "shipped" | "transit" | "completed";

export type TimelineStep = {
  id: TimelineStepId;
  label: string;
  statusValue: string | null;
  done: boolean;
  current: boolean;
  at: string | null;
};

export function timelineTemplate(fulfillment: string, provider?: string | null): Array<{ id: TimelineStepId; label: string; statusValue: string | null }> {
  if (fulfillment === "local_pickup") {
    return [
      { id: "placed", label: "Order Placed", statusValue: "pending" },
      { id: "accepted", label: "Accepted", statusValue: "confirmed" },
      { id: "preparing", label: "Preparing", statusValue: "processing" },
      { id: "ready", label: "Ready for Pickup", statusValue: "ready_for_pickup" },
      { id: "completed", label: "Completed", statusValue: "delivered" },
    ];
  }
  if (isCarrierFulfillment(provider)) {
    return [
      { id: "placed", label: "Order Placed", statusValue: "pending" },
      { id: "accepted", label: "Accepted", statusValue: "confirmed" },
      { id: "preparing", label: "Preparing", statusValue: "processing" },
      { id: "ready", label: "Awaiting Carrier Drop-Off", statusValue: "ready_for_delivery" },
      { id: "shipped", label: "Shipped", statusValue: "shipped" },
      { id: "completed", label: "Delivered", statusValue: "delivered" },
    ];
  }
  return [
    { id: "placed", label: "Order Placed", statusValue: "pending" },
    { id: "accepted", label: "Accepted", statusValue: "confirmed" },
    { id: "preparing", label: "Preparing", statusValue: "processing" },
    { id: "ready", label: "Ready for Delivery", statusValue: "ready_for_delivery" },
    { id: "transit", label: "Out for Delivery", statusValue: "shipped" },
    { id: "completed", label: "Delivered / Completed", statusValue: "delivered" },
  ];
}

const rank: Record<string, number> = {
  pending: 0,
  confirmed: 1,
  processing: 2,
  ready_for_pickup: 3,
  ready_for_delivery: 3,
  shipped: 4,
  delivered: 5,
  cancelled: -1,
};

export function buildOrderTimeline(input: {
  status: string;
  fulfillment_method: string;
  fulfillment_provider?: string | null;
  created_at: string;
  events?: Array<{ status: string; created_at: string }>;
  carrierEvents?: Array<{ event_code: string; occurred_at: string }>;
}): TimelineStep[] {
  const currentRank = rank[input.status] ?? 0;
  const times = new Map((input.events ?? []).map((event) => [event.status, event.created_at]));
  return timelineTemplate(input.fulfillment_method, input.fulfillment_provider).map((step) => {
    const stepRank = step.statusValue ? rank[step.statusValue] ?? 0 : 0;
    if (step.id === "placed") {
      const done = input.status !== "cancelled";
      return { ...step, done, current: input.status === "pending", at: done ? input.created_at : null };
    }
    const done = input.status !== "cancelled" && currentRank >= stepRank && step.statusValue != null;
    const current = input.status === step.statusValue;
    let at: string | null = null;
    if (step.statusValue && times.has(step.statusValue)) at = times.get(step.statusValue) ?? null;
    else if (step.id === "accepted" && done) at = times.get("confirmed") ?? input.created_at;
    if (!done) at = null;
    return { ...step, done, current: current && input.status !== "cancelled", at };
  });
}
