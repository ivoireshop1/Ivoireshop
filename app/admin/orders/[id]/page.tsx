import Link from "next/link";
import { notFound } from "next/navigation";
import { updateOrderStatus } from "@/src/lib/catalog/actions";
import { requireAdmin } from "@/src/lib/auth/guards";

export default async function OrderDetailPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ error?: string; success?: string }> }) {
  const [{ id }, notices] = await Promise.all([params, searchParams]);
  const { supabase } = await requireAdmin();
  const [{ data: order, error }, { data: items }] = await Promise.all([
    supabase.from("orders").select("*").eq("id", id).maybeSingle(),
    supabase.from("order_items").select("product_name, product_price, quantity").eq("order_id", id),
  ]);
  if (error) throw new Error("Unable to load order.");
  if (!order) notFound();
  return <div className="space-y-6"><Link className="text-sm text-[#173f35] underline" href="/admin/orders">Back to orders</Link><div><p className="text-[11px] uppercase tracking-[0.2em] text-[#b8964c]">Order</p><h1 className="mt-2 text-3xl font-semibold text-[#173f35]">{order.order_number}</h1></div>
    {notices.error && <p className="rounded-xl bg-red-50 p-3 text-sm text-red-800">Status could not be updated.</p>}{notices.success && <p className="rounded-xl bg-[#173f35]/5 p-3 text-sm text-[#173f35]">Order status updated.</p>}
    <div className="grid gap-5 lg:grid-cols-2"><section className="rounded-2xl bg-white p-5"><h2 className="font-semibold text-[#173f35]">Customer</h2><p className="mt-3">{order.customer_name}</p><p className="text-sm text-[#6b6b6b]">{order.customer_email}</p><p className="mt-2 text-sm text-[#6b6b6b]">{order.customer_phone ?? "No phone provided"}</p></section><form action={updateOrderStatus} className="rounded-2xl bg-white p-5"><input name="id" type="hidden" value={order.id}/><h2 className="font-semibold text-[#173f35]">Fulfillment</h2><select className="mt-3 w-full rounded-xl border border-[#173f35]/15 px-3 py-2" defaultValue={order.status} name="status">{["pending","confirmed","processing","ready_for_pickup","shipped","delivered","cancelled"].map((value) => <option key={value} value={value}>{value.replaceAll("_", " ")}</option>)}</select><p className="mt-3 text-sm text-[#6b6b6b]">Payment: {order.payment_status}</p><button className="mt-4 rounded-xl bg-[#173f35] px-4 py-2 text-sm text-white">Update status</button></form></div>
    <section className="rounded-2xl bg-white p-5"><h2 className="font-semibold text-[#173f35]">Items</h2>{!items?.length ? <p className="mt-3 text-sm text-[#6b6b6b]">No order items recorded.</p> : <div className="mt-3 space-y-2">{items.map((item, index) => <div className="flex justify-between border-b border-[#173f35]/10 py-3" key={`${item.product_name}-${index}`}><span>{item.product_name} × {item.quantity}</span><span>${(Number(item.product_price) * item.quantity).toFixed(2)}</span></div>)}</div>}<p className="mt-4 text-right text-lg font-semibold text-[#173f35]">Total ${Number(order.total).toFixed(2)}</p></section>
  </div>;
}
