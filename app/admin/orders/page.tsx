import { orderStatuses } from "@/src/lib/orders/status";
import Link from "next/link";
import { requireAdmin } from "@/src/lib/auth/guards";

export default async function AdminOrdersPage({ searchParams }: { searchParams: Promise<{ status?: string; search?: string }> }) {
  const { status = "all", search = "" } = await searchParams;
  const { supabase } = await requireAdmin();
  let query = supabase.from("orders").select("id, order_number, customer_name, total, status, payment_status, created_at").order("created_at", { ascending: false });
  if ((orderStatuses as readonly string[]).includes(status)) query = query.eq("status", status);
  const searchText = search.trim().slice(0, 100).replace(/[%_\\]/g, "");
  if (searchText) query = query.ilike("order_number", `%${searchText}%`);
  const { data: orders, error } = await query;
  if (error) throw new Error("Unable to load orders.");
  return (
    <div className="space-y-6"><div><p className="text-[11px] font-medium uppercase tracking-[0.24em] text-[#b8964c]">Sales</p><h1 className="mt-2 text-3xl font-semibold text-[#173f35]">Orders</h1></div>
      <form className="flex flex-wrap gap-3" method="get"><label className="text-sm">Order number<input className="ml-2 rounded-xl border px-3 py-2" name="search" defaultValue={search} maxLength={100} /></label><label className="text-sm">Status<select className="rounded-xl border border-[#173f35]/15 bg-white px-3 py-2" defaultValue={status} name="status"><option value="all">All orders</option>{["pending","confirmed","processing","ready_for_pickup","shipped","delivered","cancelled"].map((value) => <option key={value} value={value}>{value.replaceAll("_", " ")}</option>)}</select></label><button className="ml-2 rounded-xl bg-[#173f35] px-4 py-2 text-sm text-white">Filter</button></form>
      {!orders?.length ? <div className="rounded-2xl border border-dashed border-[#173f35]/20 bg-white p-10 text-center"><p className="font-medium text-[#173f35]">No matching orders</p><p className="mt-2 text-sm text-[#6b6b6b]">New customer orders will appear here.</p></div> : <div className="space-y-3">{orders.map((order) => <Link className="grid gap-2 rounded-2xl border border-[#173f35]/10 bg-white p-4 md:grid-cols-5" href={`/admin/orders/${order.id}`} key={order.id}><span className="font-medium text-[#173f35]">{order.order_number}</span><span>{order.customer_name}<span className="block text-xs capitalize text-muted">Payment: {order.payment_status}</span></span><span>${Number(order.total).toFixed(2)}</span><span className="capitalize">{order.status.replaceAll("_", " ")}</span><span>{new Date(order.created_at).toLocaleDateString()}</span></Link>)}</div>}
    </div>
  );
}
