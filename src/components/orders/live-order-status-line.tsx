"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/src/lib/supabase/browser";
import { formatOrderDate } from "@/src/lib/orders/buckets";
import { orderStatusLabel, paymentProviderLabel, paymentStatusLabel } from "@/src/lib/orders/status";
import { fulfillmentDisplay } from "@/src/lib/delivery/labels";
import { useLiveNotifications } from "@/src/components/realtime/live-notifications-provider";

export function LiveOrderStatusLine({
  orderId,
  createdAt,
  status,
  paymentStatus,
  paymentProvider,
  paymentMethod,
  fulfillmentMethod,
  fulfillmentProvider,
}: {
  orderId: string;
  createdAt: string;
  status: string;
  paymentStatus: string;
  paymentProvider?: string | null;
  paymentMethod?: string | null;
  fulfillmentMethod: string;
  fulfillmentProvider?: string | null;
}) {
  const { orderTicks } = useLiveNotifications();
  const [live, setLive] = useState({
    status,
    payment_status: paymentStatus,
    payment_provider: paymentProvider,
    payment_method: paymentMethod,
    fulfillment_method: fulfillmentMethod,
    fulfillment_provider: fulfillmentProvider,
  });
  const tick = orderTicks[orderId];

  useEffect(() => {
    if (!tick) return;
    const client = createClient();
    let cancelled = false;
    void client
      .from("orders")
      .select("status, payment_status, payment_provider, payment_method, fulfillment_method, fulfillment_provider")
      .eq("id", orderId)
      .maybeSingle()
      .then(({ data }) => {
        if (!cancelled && data) setLive(data);
      });
    return () => {
      cancelled = true;
    };
  }, [orderId, tick]);

  return (
    <>
      <p className="mt-3 text-muted">
        {formatOrderDate(createdAt)} · {new Date(createdAt).toLocaleTimeString()} · {orderStatusLabel(live.status, live.fulfillment_method, live.fulfillment_provider)} · {fulfillmentDisplay({ fulfillment_method: live.fulfillment_method, fulfillment_provider: live.fulfillment_provider })}
      </p>
      <p className="mt-3 text-muted">
        {paymentStatusLabel(live.payment_status, live.payment_provider)}
        {live.payment_provider || live.payment_method ? ` · ${paymentProviderLabel(live.payment_provider, live.payment_method)}` : ""}
      </p>
    </>
  );
}
