"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/src/lib/supabase/browser";
import { AdminOrderListHeader, AdminOrderListItem, type AdminOrderListItemData } from "@/src/components/admin/admin-order-list-item";
import { matchesAdminOrderView, type AdminOrderView } from "@/src/lib/orders/buckets";
import { orderMatchesOpsFilters, orderMatchesSearch } from "@/src/lib/orders/ops";
import { useLiveNotifications } from "@/src/components/realtime/live-notifications-provider";

export function LiveAdminOrderList({
  initialOrders,
  view,
  search = "",
  attention = "",
  status = "all",
  payment = "all",
  fulfillment = "all",
  carrier = "all",
  date = "all",
  shipping = "all",
}: {
  initialOrders: AdminOrderListItemData[];
  view: AdminOrderView;
  search?: string;
  attention?: string;
  status?: string;
  payment?: string;
  fulfillment?: string;
  carrier?: string;
  date?: string;
  shipping?: string;
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
      .select("id, order_number, confirmation_code, customer_name, customer_email, customer_phone, total, status, payment_status, payment_provider, fulfillment_method, fulfillment_provider, fulfillment_service, tracking_number, created_at, order_items(product_name, quantity, image_url, products(product_images(image_url, position)))")
      .order("created_at", { ascending: false })
      .then(({ data }) => {
        if (cancelled || !data) return;
        setLiveOrders(
          data.filter((order) => {
            if (!matchesAdminOrderView(order.status, view)) return false;
            if (search && !orderMatchesSearch(order, search)) return false;
            return orderMatchesOpsFilters(order, { status, payment, fulfillment, carrier, date, shipping, attention });
          }),
        );
      });
    return () => {
      cancelled = true;
    };
  }, [dashboardTick, view, search, attention, status, payment, fulfillment, carrier, date, shipping]);

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
