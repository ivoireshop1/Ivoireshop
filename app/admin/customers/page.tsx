import Link from "next/link";
import { requireAdmin } from "@/src/lib/auth/guards";

export default async function AdminCustomersPage({ searchParams }: { searchParams: Promise<{ search?: string }> }) {
  const { search = "" } = await searchParams;
  const { supabase } = await requireAdmin();
  const { data: profiles, error } = await supabase.from("profiles").select("id, full_name, email, created_at").order("created_at", { ascending: false });
  if (error) throw new Error("Unable to load customers.");
  const needle = search.toLowerCase();
  const customers = (profiles ?? []).filter((profile) => !needle || profile.full_name.toLowerCase().includes(needle) || profile.email.toLowerCase().includes(needle));
  return (
    <div className="space-y-6"><div><p className="text-[11px] font-medium uppercase tracking-[0.24em] text-[#b8964c]">People</p><h1 className="mt-2 text-3xl font-semibold text-[#173f35]">Customers</h1></div>
      <form method="get"><input className="rounded-xl border border-[#173f35]/15 px-3 py-2" defaultValue={search} name="search" placeholder="Search name or email" /><button className="ml-2 rounded-xl bg-[#173f35] px-4 py-2 text-sm text-white">Search</button></form>
      {!customers.length ? <div className="rounded-2xl border border-dashed border-[#173f35]/20 bg-white p-10 text-center text-[#6b6b6b]">No customers found.</div> : <div className="space-y-3">{customers.map((customer) => <Link className="grid gap-2 rounded-2xl border border-[#173f35]/10 bg-white p-4 md:grid-cols-3" href={`/admin/customers/${customer.id}`} key={customer.id}><span className="font-medium text-[#173f35]">{customer.full_name || "Customer"}</span><span className="text-[#6b6b6b]">{customer.email}</span><span className="text-[#6b6b6b]">Joined {new Date(customer.created_at).toLocaleDateString()}</span></Link>)}</div>}
    </div>
  );
}
