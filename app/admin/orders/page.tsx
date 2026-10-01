import { AdminOrderListHeader, AdminOrderListItem } from "@/src/components/admin/admin-order-list-item";
import { orderStatusLabel, orderStatuses, paymentStatusLabel } from "@/src/lib/orders/status";
import { requireAdmin } from "@/src/lib/auth/guards";
import { AdminLoadFailure } from "@/src/components/admin/admin-load-failure";

const paymentFilters = ["pending", "paid", "failed", "cancelled", "refunded"] as const;
const fulfillmentFilters = ["local_pickup", "delivery"] as const;

export default async function AdminOrdersPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; search?: string; payment?: string; fulfillment?: string; shipping?: string }>;
}) {
  const { status = "all", search = "", payment = "all", fulfillment = "all", shipping = "all" } = await searchParams;
  const { supabase } = await requireAdmin();
  let query = supabase
    .from("orders")
    .select("id, order_number, confirmation_code, customer_name, customer_email, total, status, payment_status, payment_provider, fulfillment_method, fulfillment_provider, fulfillment_service, tracking_number, created_at")
    .order("created_at", { ascending: false });
  if ((orderStatuses as readonly string[]).includes(status)) query = query.eq("status", status);
  if ((paymentFilters as readonly string[]).includes(payment)) query = query.eq("payment_status", payment);
  if ((fulfillmentFilters as readonly string[]).includes(fulfillment)) query = query.eq("fulfillment_method", fulfillment);
  if (shipping === "awaiting" || shipping === "shipped" || shipping === "missing-tracking") {
    query = query.in("fulfillment_provider", ["ups", "usps"]);
    if (shipping === "awaiting") query = query.not("status", "in", "(shipped,delivered,cancelled)");
    if (shipping === "shipped") query = query.eq("status", "shipped");
    if (shipping === "missing-tracking") query = query.is("tracking_number", null).neq("status", "cancelled");
  }
  const searchText = search.trim().slice(0, 100).replace(/[%_\\]/g, "");
  if (searchText) {
    query = query.or(`order_number.ilike.%${searchText}%,confirmation_code.ilike.%${searchText}%,customer_name.ilike.%${searchText}%,customer_email.ilike.%${searchText}%`);
  }
  const { data: orders, error } = await query;
  if (error) return <AdminLoadFailure message="Unable to load orders." title="Orders" />;
  return (
    <div className="@container min-w-0 space-y-6">
      <div>
        <p className="text-[11px] font-medium uppercase tracking-[0.24em] text-[#b8964c]">Sales</p>
        <h1 className="mt-2 text-3xl font-semibold text-[#173f35]">Orders</h1>
      </div>
      {shipping !== "all" ? <p className="text-sm text-[#6b6b6b]">Shipping filter: {shipping.replace("-", " ")}</p> : null}
      <form className="grid grid-cols-1 gap-3 rounded-2xl border border-[#173f35]/10 bg-white p-4 @md:grid-cols-2 @4xl:grid-cols-[minmax(16rem,1.6fr)_repeat(3,minmax(8rem,1fr))_auto]" method="get">
        {shipping !== "all" ? <input name="shipping" type="hidden" value={shipping} /> : null}
        <label className="min-w-0 text-sm text-[#173f35]" htmlFor="order-search">
          Search
          <input className="mt-2 min-h-11 w-full min-w-0 rounded-xl border border-[#173f35]/15 bg-[#f9f7f3] px-3 py-2.5 text-[#173f35] outline-none" defaultValue={search} id="order-search" maxLength={100} name="search" placeholder="Order #, IVO code, name, email" />
        </label>
        <label className="min-w-0 text-sm text-[#173f35]" htmlFor="order-status">
          Fulfillment status
          <select className="mt-2 min-h-11 w-full min-w-0 rounded-xl border border-[#173f35]/15 bg-[#f9f7f3] px-3 py-2.5 text-[#173f35] outline-none" defaultValue={status} id="order-status" name="status">
            <option value="all">All statuses</option>
            {orderStatuses.map((value) => (
              <option key={value} value={value}>{orderStatusLabel(value, fulfillment === "delivery" ? "delivery" : "local_pickup")}</option>
            ))}
          </select>
        </label>
        <label className="min-w-0 text-sm text-[#173f35]" htmlFor="order-payment">
          Payment status
          <select className="mt-2 min-h-11 w-full min-w-0 rounded-xl border border-[#173f35]/15 bg-[#f9f7f3] px-3 py-2.5 text-[#173f35] outline-none" defaultValue={payment} id="order-payment" name="payment">
            <option value="all">All payments</option>
            {paymentFilters.map((value) => (
              <option key={value} value={value}>{paymentStatusLabel(value)}</option>
            ))}
          </select>
        </label>
        <label className="min-w-0 text-sm text-[#173f35]" htmlFor="order-fulfillment">
          Pickup / Delivery
          <select className="mt-2 min-h-11 w-full min-w-0 rounded-xl border border-[#173f35]/15 bg-[#f9f7f3] px-3 py-2.5 text-[#173f35] outline-none" defaultValue={fulfillment} id="order-fulfillment" name="fulfillment">
            <option value="all">All methods</option>
            <option value="local_pickup">Pickup</option>
            <option value="delivery">Delivery</option>
          </select>
        </label>
        <div className="flex min-w-0 items-end @md:col-span-2 @4xl:col-span-1">
          <button className="min-h-11 w-full rounded-xl bg-[#173f35] px-4 py-2.5 text-sm font-medium text-white @4xl:w-auto @4xl:min-w-28" type="submit">Filter</button>
        </div>
      </form>
      {!orders?.length ? (
        <div className="rounded-2xl border border-dashed border-[#173f35]/20 bg-white p-10 text-center">
          <p className="font-medium text-[#173f35]">No matching orders</p>
          <p className="mt-2 text-sm text-[#6b6b6b]">New customer orders will appear here.</p>
        </div>
      ) : (
        <div className="space-y-3">
          <AdminOrderListHeader />
          {orders.map((order) => (
            <AdminOrderListItem key={order.id} order={order} />
          ))}
        </div>
      )}
    </div>
  );
}
