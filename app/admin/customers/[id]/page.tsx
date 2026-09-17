import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAdmin } from "@/src/lib/auth/guards";

export default async function CustomerDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { supabase } = await requireAdmin();
  const [{ data: profile, error }, { data: orders }] = await Promise.all([
    supabase.from("profiles").select("full_name, email, phone, created_at").eq("id", id).maybeSingle(),
    supabase.from("orders").select("id, order_number, total, status, created_at").eq("user_id", id).order("created_at", { ascending: false }),
  ]);
  if (error) throw new Error("Unable to load customer.");
  if (!profile) notFound();
  return <div className="space-y-6"><Link className="text-sm text-[#173f35] underline" href="/admin/customers">Back to customers</Link><section className="rounded-2xl bg-white p-6"><p className="text-[11px] uppercase tracking-[0.2em] text-[#b8964c]">Customer</p><h1 className="mt-2 text-3xl font-semibold text-[#173f35]">{profile.full_name || "Customer"}</h1><p className="mt-3 text-[#6b6b6b]">{profile.email}</p><p className="text-sm text-[#6b6b6b]">{profile.phone ?? "No phone provided"}</p><p className="mt-3 text-sm text-[#6b6b6b]">Joined {new Date(profile.created_at).toLocaleDateString()}</p></section><section className="rounded-2xl bg-white p-6"><h2 className="font-semibold text-[#173f35]">Order history</h2>{!orders?.length ? <p className="mt-3 text-sm text-[#6b6b6b]">No orders yet.</p> : <div className="mt-3 space-y-2">{orders.map((order) => <Link className="flex justify-between border-b border-[#173f35]/10 py-3" href={`/admin/orders/${order.id}`} key={order.id}><span>{order.order_number}</span><span>${Number(order.total).toFixed(2)} · {order.status}</span></Link>)}</div>}</section></div>;
}
