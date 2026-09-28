import { orderStatusLabel, orderStatuses, paymentStatusLabel } from "@/src/lib/orders/status";
import Link from "next/link";
import { requireAdmin } from "@/src/lib/auth/guards";

const paymentFilters = ["pending", "paid", "failed", "cancelled", "refunded"] as const;
const fulfillmentFilters = ["local_pickup", "delivery"] as const;

export default async function AdminOrdersPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; search?: string; payment?: string; fulfillment?: string }>;
}) {
  const { status = "all", search = "", payment = "all", fulfillment = "all" } = await searchParams;
  const { supabase } = await requireAdmin();
  let query = supabase
    .from("orders")
    .select("id, order_number, confirmation_code, customer_name, customer_email, total, status, payment_status, payment_provider, fulfillment_method, created_at")
    .order("created_at", { ascending: false });
  if ((orderStatuses as readonly string[]).includes(status)) query = query.eq("status", status);
  if ((paymentFilters as readonly string[]).includes(payment)) query = query.eq("payment_status", payment);
  if ((fulfillmentFilters as readonly string[]).includes(fulfillment)) query = query.eq("fulfillment_method", fulfillment);
  const searchText = search.trim().slice(0, 100).replace(/[%_\\]/g, "");
  if (searchText) {
    query = query.or(`order_number.ilike.%${searchText}%,confirmation_code.ilike.%${searchText}%,customer_name.ilike.%${searchText}%,customer_email.ilike.%${searchText}%`);
  }
  const { data: orders, error } = await query;
  if (error) throw new Error("Unable to load orders.");
  return (
    <div className="space-y-6">
      <div>
        <p className="text-[11px] font-medium uppercase tracking-[0.24em] text-[#b8964c]">Sales</p>
        <h1 className="mt-2 text-3xl font-semibold text-[#173f35]">Orders</h1>
      </div>
      <form className="grid gap-3 rounded-2xl border border-[#173f35]/10 bg-white p-4 sm:grid-cols-2 lg:grid-cols-5" method="get">
        <label className="text-sm" htmlFor="order-search">
          Search
          <input className="mt-2 w-full rounded-xl border px-3 py-2" defaultValue={search} id="order-search" maxLength={100} name="search" placeholder="Order #, IVO code, name, email" />
        </label>
        <label className="text-sm" htmlFor="order-status">
          Fulfillment status
          <select className="mt-2 w-full rounded-xl border border-[#173f35]/15 bg-white px-3 py-2" defaultValue={status} id="order-status" name="status">
            <option value="all">All statuses</option>
            {orderStatuses.map((value) => (
              <option key={value} value={value}>{orderStatusLabel(value, fulfillment === "delivery" ? "delivery" : "local_pickup")}</option>
            ))}
          </select>
        </label>
        <label className="text-sm" htmlFor="order-payment">
          Payment status
          <select className="mt-2 w-full rounded-xl border border-[#173f35]/15 bg-white px-3 py-2" defaultValue={payment} id="order-payment" name="payment">
            <option value="all">All payments</option>
            {paymentFilters.map((value) => (
              <option key={value} value={value}>{paymentStatusLabel(value)}</option>
            ))}
          </select>
        </label>
        <label className="text-sm" htmlFor="order-fulfillment">
          Pickup / Delivery
          <select className="mt-2 w-full rounded-xl border border-[#173f35]/15 bg-white px-3 py-2" defaultValue={fulfillment} id="order-fulfillment" name="fulfillment">
            <option value="all">All methods</option>
            <option value="local_pickup">Pickup</option>
            <option value="delivery">Delivery</option>
          </select>
        </label>
        <div className="flex items-end">
          <button className="min-h-11 w-full rounded-xl bg-[#173f35] px-4 py-2 text-sm text-white">Filter</button>
        </div>
      </form>
      {!orders?.length ? (
        <div className="rounded-2xl border border-dashed border-[#173f35]/20 bg-white p-10 text-center">
          <p className="font-medium text-[#173f35]">No matching orders</p>
          <p className="mt-2 text-sm text-[#6b6b6b]">New customer orders will appear here.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {orders.map((order) => (
            <Link className="grid gap-2 rounded-2xl border border-[#173f35]/10 bg-white p-4 md:grid-cols-6" href={`/admin/orders/${order.id}`} key={order.id}>
              <span className="font-medium text-[#173f35]">
                {order.order_number}
                <span className="mt-1 block font-mono text-xs tracking-widest">{order.confirmation_code}</span>
              </span>
              <span>
                {order.customer_name}
                <span className="block break-all text-xs text-muted">{order.customer_email}</span>
              </span>
              <span>${Number(order.total).toFixed(2)}</span>
              <span>
                {paymentStatusLabel(order.payment_status, order.payment_provider)}
                <span className="block text-xs capitalize text-muted">{(order.payment_provider || "To be collected").replaceAll("_", " ")}</span>
              </span>
              <span>
                {orderStatusLabel(order.status, order.fulfillment_method)}
                <span className="block text-xs capitalize text-muted">{order.fulfillment_method?.replaceAll("_", " ")}</span>
              </span>
              <span>{new Date(order.created_at).toLocaleDateString()}</span>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
