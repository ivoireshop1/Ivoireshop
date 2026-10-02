"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/src/lib/supabase/browser";
import { LiveCustomerOrderCard } from "@/src/components/customer/live-customer-order-card";
import type { CustomerOrderSummary } from "@/src/components/customer/customer-order-card";
import { isCustomerCurrentOrder } from "@/src/lib/orders/buckets";
import { useLiveNotifications } from "@/src/components/realtime/live-notifications-provider";

export function LiveCustomerOrderLists({ orders }: { orders: CustomerOrderSummary[] }) {
  const { orderTicks } = useLiveNotifications();
  const [rows, setRows] = useState(orders);
  const tickStamp = useMemo(() => Object.values(orderTicks).reduce((sum, value) => sum + value, 0), [orderTicks]);

  useEffect(() => {
    if (!tickStamp) return;
    const client = createClient();
    let cancelled = false;
    void Promise.all(
      rows.map((row) =>
        client
          .from("orders")
          .select("id, order_number, confirmation_code, status, payment_status, total, fulfillment_method, fulfillment_provider, tracking_number, created_at")
          .eq("id", row.id)
          .maybeSingle(),
      ),
    ).then((results) => {
      if (cancelled) return;
      setRows((current) =>
        current.map((row, index) => {
          const next = results[index]?.data;
          return next ? { ...row, ...next, order_items: row.order_items } : row;
        }),
      );
    });
    return () => {
      cancelled = true;
    };
  }, [tickStamp, rows.length]);

  const current = rows.filter((order) => isCustomerCurrentOrder(order.status, order.payment_status));
  const past = rows.filter((order) => !isCustomerCurrentOrder(order.status, order.payment_status));

  return (
    <>
      <section className="mt-10" id="current-orders">
        <h2 className="text-2xl font-semibold text-forest-green">Current orders</h2>
        <p className="mt-1 text-sm text-muted">Placed, preparing, ready, or on the way.</p>
        {current.length ? (
          <div className="mt-5 grid gap-4">
            {current.map((order) => <LiveCustomerOrderCard key={order.id} order={order} />)}
          </div>
        ) : (
          <p className="mt-3 text-sm text-muted">No current orders. When you place one, it will show up here.</p>
        )}
      </section>
      {past.length > 0 ? (
        <section className="mt-12" id="past-orders">
          <h2 className="text-2xl font-semibold text-forest-green">Past orders</h2>
          <p className="mt-1 text-sm text-muted">Completed, picked up, delivered, cancelled, or refunded.</p>
          <div className="mt-5 grid gap-4">
            {past.map((order) => <LiveCustomerOrderCard key={`past-${order.id}`} order={order} />)}
          </div>
        </section>
      ) : null}
    </>
  );
}
