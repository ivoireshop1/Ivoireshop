"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/src/lib/supabase/browser";
import { CustomerOrderCard, type CustomerOrderSummary } from "@/src/components/customer/customer-order-card";
import { useLiveNotifications } from "@/src/components/realtime/live-notifications-provider";

export function LiveCustomerOrderCard({ order }: { order: CustomerOrderSummary }) {
  const { orderTicks } = useLiveNotifications();
  const [live, setLive] = useState(order);
  const tick = orderTicks[order.id];

  useEffect(() => {
    if (!tick) return;
    const client = createClient();
    let cancelled = false;
    void client
      .from("orders")
      .select("id, order_number, confirmation_code, status, payment_status, total, fulfillment_method, fulfillment_provider, tracking_number, created_at")
      .eq("id", order.id)
      .maybeSingle()
      .then(({ data }) => {
        if (cancelled || !data) return;
        setLive((current) => ({ ...current, ...data, order_items: current.order_items }));
      });
    return () => {
      cancelled = true;
    };
  }, [order.id, tick]);

  return <CustomerOrderCard order={live} />;
}
