export function isCarrierFulfillment(provider?: string | null) {
  const value = (provider ?? "").toLowerCase();
  return value === "ups" || value === "usps";
}

export function isLocalDelivery(fulfillment: string, provider?: string | null) {
  return fulfillment === "delivery" && !isCarrierFulfillment(provider);
}

export type TimelineStepId = "accepted" | "preparing" | "ready" | "shipped" | "transit" | "completed";

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
      { id: "accepted", label: "Order Accepted", statusValue: "confirmed" },
      { id: "preparing", label: "Preparing", statusValue: "processing" },
      { id: "ready", label: "Ready for Pickup", statusValue: "ready_for_pickup" },
      { id: "completed", label: "Picked Up / Completed", statusValue: "delivered" },
    ];
  }
  if (isCarrierFulfillment(provider)) {
    return [
      { id: "accepted", label: "Order Accepted", statusValue: "confirmed" },
      { id: "preparing", label: "Preparing", statusValue: "processing" },
      { id: "shipped", label: "Shipped", statusValue: "shipped" },
      { id: "transit", label: "In Transit", statusValue: null },
      { id: "completed", label: "Delivered", statusValue: "delivered" },
    ];
  }
  return [
    { id: "accepted", label: "Order Accepted", statusValue: "confirmed" },
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
  const transitEvent = (input.carrierEvents ?? []).find((event) =>
    ["in_transit", "out_for_delivery", "delivered"].includes(event.event_code),
  );
  return timelineTemplate(input.fulfillment_method, input.fulfillment_provider).map((step) => {
    const stepRank = step.statusValue ? rank[step.statusValue] ?? 0 : 0;
    const accepted = step.id === "accepted";
    if (step.id === "transit" && isCarrierFulfillment(input.fulfillment_provider)) {
      const done = input.status !== "cancelled" && Boolean(transitEvent);
      const current = input.status === "shipped" && !transitEvent;
      return { ...step, done, current, at: done ? transitEvent?.occurred_at ?? null : null };
    }
    const done = input.status !== "cancelled" && (accepted || (step.statusValue != null && currentRank >= stepRank));
    const shippedIsCurrent = input.status === "shipped" && step.statusValue === "shipped";
    const current = accepted
      ? input.status === "pending" || input.status === "confirmed"
      : shippedIsCurrent && isCarrierFulfillment(input.fulfillment_provider)
        ? false
        : input.status === step.statusValue;
    let at: string | null = null;
    if (accepted) at = input.created_at;
    else if (step.statusValue && times.has(step.statusValue)) at = times.get(step.statusValue) ?? null;
    if (!done) at = null;
    return { ...step, done, current: current && input.status !== "cancelled", at };
  });
}
