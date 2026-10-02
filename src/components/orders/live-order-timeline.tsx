"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/src/lib/supabase/browser";
import { OrderTimeline } from "@/src/components/orders/order-timeline";
import { useLiveNotifications } from "@/src/components/realtime/live-notifications-provider";

type OrderSnapshot = {
  status: string;
  fulfillment_method: string;
  fulfillment_provider?: string | null;
  created_at: string;
};

export function LiveOrderTimeline({
  orderId,
  order,
  events = [],
}: {
  orderId: string;
  order: OrderSnapshot;
  events?: Array<{ status: string; created_at: string }>;
}) {
  const { orderTicks, connection } = useLiveNotifications();
  const [liveOrder, setLiveOrder] = useState(order);
  const [liveEvents, setLiveEvents] = useState(events);
  const tick = orderTicks[orderId];

  useEffect(() => {
    if (connection === "reconnecting") return;
    const client = createClient();
    let cancelled = false;
    async function load() {
      const [{ data: nextOrder }, { data: nextEvents }] = await Promise.all([
        client.from("orders").select("status, fulfillment_method, fulfillment_provider, created_at").eq("id", orderId).maybeSingle(),
        client.from("order_status_events").select("status, created_at").eq("order_id", orderId).order("created_at", { ascending: true }),
      ]);
      if (cancelled) return;
      if (nextOrder) setLiveOrder(nextOrder);
      if (nextEvents) setLiveEvents(nextEvents);
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [orderId, tick, connection]);

  return <OrderTimeline events={liveEvents} order={liveOrder} />;
}
