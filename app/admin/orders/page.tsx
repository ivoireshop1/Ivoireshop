import { orderStatusLabel, orderStatuses, paymentStatusLabel } from "@/src/lib/orders/status";
import { requireAdmin } from "@/src/lib/auth/guards";
import { AdminLoadFailure } from "@/src/components/admin/admin-load-failure";
import { LiveAdminOrderList } from "@/src/components/admin/live-admin-order-list";
import type { AdminOrderView } from "@/src/lib/orders/buckets";
import { startOfStoreDayIso } from "@/src/lib/store/timezone";
import Link from "next/link";

const paymentFilters = ["pending", "paid", "failed", "cancelled", "refunded"] as const;
const fulfillmentFilters = ["local_pickup", "delivery"] as const;
const views: { id: AdminOrderView; label: string }[] = [
  { id: "new", label: "New Orders" },
  { id: "in_progress", label: "In Progress" },
  { id: "completed", label: "Completed" },
  { id: "cancelled", label: "Cancelled" },
  { id: "all", label: "All Orders" },
];

export default async function AdminOrdersPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; search?: string; payment?: string; fulfillment?: string; shipping?: string; view?: string; carrier?: string; date?: string; attention?: string }>;
}) {
  const { status = "all", search = "", payment = "all", fulfillment = "all", shipping = "all", view: viewRaw = "new", carrier = "all", date = "all", attention = "" } = await searchParams;
  const view = (views.some((item) => item.id === viewRaw) ? viewRaw : "all") as AdminOrderView;
  const { supabase } = await requireAdmin();
  let query = supabase
    .from("orders")
    .select("id, order_number, confirmation_code, customer_name, customer_email, customer_phone, total, status, payment_status, payment_provider, fulfillment_method, fulfillment_provider, fulfillment_service, tracking_number, created_at, order_items(product_name, quantity, image_url, products(product_images(image_url, position)))")
    .order("created_at", { ascending: false });
  if ((orderStatuses as readonly string[]).includes(status)) query = query.eq("status", status);
  else if (view === "new") query = query.eq("status", "pending");
  else if (view === "in_progress") query = query.in("status", ["confirmed", "processing", "ready_for_pickup", "ready_for_delivery", "shipped"]);
  else if (view === "completed") query = query.eq("status", "delivered");
  else if (view === "cancelled") query = query.eq("status", "cancelled");
  if ((paymentFilters as readonly string[]).includes(payment)) query = query.eq("payment_status", payment);
  if ((fulfillmentFilters as readonly string[]).includes(fulfillment)) query = query.eq("fulfillment_method", fulfillment);
  if (carrier === "ups" || carrier === "usps") query = query.eq("fulfillment_provider", carrier);
  if (carrier === "local") query = query.eq("fulfillment_method", "delivery").not("fulfillment_provider", "in", "(ups,usps)");
  if (carrier === "pickup") query = query.eq("fulfillment_method", "local_pickup");
  if (date === "today") query = query.gte("created_at", startOfStoreDayIso());
  if (date === "week") query = query.gte("created_at", new Date(new Date(startOfStoreDayIso()).getTime() - 6 * 24 * 60 * 60 * 1000).toISOString());
  if (attention === "needs_acceptance") query = query.eq("status", "pending");
  if (attention === "preparing") query = query.eq("status", "processing");
  if (attention === "ready_pickup") query = query.eq("status", "ready_for_pickup");
  if (attention === "ready_delivery") query = query.eq("status", "ready_for_delivery").eq("fulfillment_method", "delivery").not("fulfillment_provider", "in", "(ups,usps)");
  if (attention === "awaiting_tracking") query = query.eq("status", "ready_for_delivery").in("fulfillment_provider", ["ups", "usps"]).is("tracking_number", null);
  if (attention === "out_for_delivery") query = query.eq("status", "shipped").not("fulfillment_provider", "in", "(ups,usps)");
  if (shipping === "awaiting" || shipping === "shipped" || shipping === "missing-tracking") {
    query = query.in("fulfillment_provider", ["ups", "usps"]);
    if (shipping === "awaiting") query = query.not("status", "in", "(shipped,delivered,cancelled)");
    if (shipping === "shipped") query = query.eq("status", "shipped");
    if (shipping === "missing-tracking") query = query.is("tracking_number", null).neq("status", "cancelled");
  }
  const searchText = search.trim().slice(0, 100).replace(/[%_\\]/g, "");
  if (searchText) {
    query = query.or(`order_number.ilike.%${searchText}%,confirmation_code.ilike.%${searchText}%,customer_name.ilike.%${searchText}%,customer_email.ilike.%${searchText}%,customer_phone.ilike.%${searchText}%,tracking_number.ilike.%${searchText}%`);
  }
  const { data: orders, error } = await query;
  if (error) return <AdminLoadFailure message="Unable to load orders." title="Orders" />;
  const hrefFor = (nextView: AdminOrderView) => {
    const params = new URLSearchParams();
    params.set("view", nextView);
    if (search) params.set("search", search);
    if (status !== "all") params.set("status", status);
    if (payment !== "all") params.set("payment", payment);
    if (fulfillment !== "all") params.set("fulfillment", fulfillment);
    if (shipping !== "all") params.set("shipping", shipping);
    if (carrier !== "all") params.set("carrier", carrier);
    if (date !== "all") params.set("date", date);
    if (attention) params.set("attention", attention);
    return `/admin/orders?${params.toString()}`;
  };
  return (
    <div className="@container min-w-0 space-y-6">
      <div>
        <p className="text-[11px] font-medium uppercase tracking-[0.24em] text-[#b8964c]">Operations</p>
        <h1 className="mt-2 text-3xl font-semibold text-[#173f35]">Order Control Center</h1>
      </div>
      <nav aria-label="Order views" className="flex min-w-0 flex-wrap gap-2">
        {views.map((item) => (
          <Link
            aria-current={view === item.id ? "page" : undefined}
            className={`inline-flex min-h-11 items-center rounded-xl px-3 text-sm font-semibold ${view === item.id ? "bg-[#173f35] text-white" : "border border-[#173f35]/15 bg-white text-[#173f35]"}`}
            href={hrefFor(item.id)}
            key={item.id}
          >
            {item.label}
          </Link>
        ))}
      </nav>
      <form className="grid grid-cols-1 gap-3 rounded-2xl border border-[#173f35]/10 bg-white p-4 @md:grid-cols-2 @4xl:grid-cols-3" method="get">
        {shipping !== "all" ? <input name="shipping" type="hidden" value={shipping} /> : null}
        {attention ? <input name="attention" type="hidden" value={attention} /> : null}
        <input name="view" type="hidden" value={view} />
        <label className="min-w-0 text-sm text-[#173f35]" htmlFor="order-search">
          Search
          <input className="mt-2 min-h-11 w-full min-w-0 rounded-xl border border-[#173f35]/15 bg-[#f9f7f3] px-3 py-2.5 text-[#173f35] outline-none" defaultValue={search} id="order-search" maxLength={100} name="search" placeholder="Order #, name, email, phone, tracking" />
        </label>
        <label className="min-w-0 text-sm text-[#173f35]" htmlFor="order-status">
          Status
          <select className="mt-2 min-h-11 w-full min-w-0 rounded-xl border border-[#173f35]/15 bg-[#f9f7f3] px-3 py-2.5 text-[#173f35] outline-none" defaultValue={status} id="order-status" name="status">
            <option value="all">All statuses</option>
            {orderStatuses.map((value) => (
              <option key={value} value={value}>{orderStatusLabel(value, fulfillment === "delivery" ? "delivery" : "local_pickup")}</option>
            ))}
          </select>
        </label>
        <label className="min-w-0 text-sm text-[#173f35]" htmlFor="order-payment">
          Payment
          <select className="mt-2 min-h-11 w-full min-w-0 rounded-xl border border-[#173f35]/15 bg-[#f9f7f3] px-3 py-2.5 text-[#173f35] outline-none" defaultValue={payment} id="order-payment" name="payment">
            <option value="all">All payments</option>
            {paymentFilters.map((value) => (
              <option key={value} value={value}>{paymentStatusLabel(value)}</option>
            ))}
          </select>
        </label>
        <label className="min-w-0 text-sm text-[#173f35]" htmlFor="order-fulfillment">
          Fulfillment
          <select className="mt-2 min-h-11 w-full min-w-0 rounded-xl border border-[#173f35]/15 bg-[#f9f7f3] px-3 py-2.5 text-[#173f35] outline-none" defaultValue={fulfillment} id="order-fulfillment" name="fulfillment">
            <option value="all">All methods</option>
            <option value="local_pickup">Pickup</option>
            <option value="delivery">Delivery</option>
          </select>
        </label>
        <label className="min-w-0 text-sm text-[#173f35]" htmlFor="order-carrier">
          Carrier
          <select className="mt-2 min-h-11 w-full min-w-0 rounded-xl border border-[#173f35]/15 bg-[#f9f7f3] px-3 py-2.5 text-[#173f35] outline-none" defaultValue={carrier} id="order-carrier" name="carrier">
            <option value="all">All</option>
            <option value="pickup">Pickup</option>
            <option value="local">Local Delivery</option>
            <option value="ups">UPS</option>
            <option value="usps">USPS</option>
          </select>
        </label>
        <label className="min-w-0 text-sm text-[#173f35]" htmlFor="order-date">
          Date
          <select className="mt-2 min-h-11 w-full min-w-0 rounded-xl border border-[#173f35]/15 bg-[#f9f7f3] px-3 py-2.5 text-[#173f35] outline-none" defaultValue={date} id="order-date" name="date">
            <option value="all">Any time</option>
            <option value="today">Today</option>
            <option value="week">This week</option>
          </select>
        </label>
        <div className="flex min-w-0 items-end">
          <button className="min-h-11 w-full rounded-xl bg-[#173f35] px-4 py-2.5 text-sm font-medium text-white" type="submit">Filter</button>
        </div>
      </form>
      <LiveAdminOrderList
        attention={attention}
        carrier={carrier}
        date={date}
        fulfillment={fulfillment}
        initialOrders={orders ?? []}
        key={`${view}-${search}-${status}-${payment}-${fulfillment}-${carrier}-${date}-${attention}-${shipping}`}
        payment={payment}
        search={search}
        shipping={shipping}
        status={status}
        view={view}
      />
    </div>
  );
}
