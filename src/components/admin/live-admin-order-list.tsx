"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/src/lib/supabase/browser";
import { AdminOrderListHeader, AdminOrderListItem, type AdminOrderListItemData } from "@/src/components/admin/admin-order-list-item";
import { matchesAdminOrderView, type AdminOrderView } from "@/src/lib/orders/buckets";
import { useLiveNotifications } from "@/src/components/realtime/live-notifications-provider";

export function LiveAdminOrderList({
  initialOrders,
  view,
}: {
  initialOrders: AdminOrderListItemData[];
  view: AdminOrderView;
}) {
  const { dashboardTick } = useLiveNotifications();
  const [liveOrders, setLiveOrders] = useState<AdminOrderListItemData[] | null>(null);
  const orders = liveOrders ?? initialOrders;

  useEffect(() => {
    if (!dashboardTick) return;
    const client = createClient();
    let cancelled = false;
    void client
      .from("orders")
      .select("id, order_number, confirmation_code, customer_name, customer_email, total, status, payment_status, payment_provider, fulfillment_method, fulfillment_provider, fulfillment_service, tracking_number, created_at")
      .order("created_at", { ascending: false })
      .then(({ data }) => {
        if (cancelled || !data) return;
        setLiveOrders(data.filter((order) => matchesAdminOrderView(order.status, view)));
      });
    return () => {
      cancelled = true;
    };
  }, [dashboardTick, view]);

  if (!orders.length) {
    return (
      <div className="rounded-2xl border border-dashed border-[#173f35]/20 bg-white p-10 text-center">
        <p className="font-medium text-[#173f35]">No matching orders</p>
        <p className="mt-2 text-sm text-[#6b6b6b]">Orders in this operational state will appear here.</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <AdminOrderListHeader />
      {orders.map((order) => (
        <AdminOrderListItem key={order.id} order={order} />
      ))}
    </div>
  );
}
