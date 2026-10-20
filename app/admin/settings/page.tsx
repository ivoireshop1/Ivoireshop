import Link from "next/link";
import { requireAdmin } from "@/src/lib/auth/guards";
import { createClient } from "@/src/lib/supabase/server";
import { getStoreProfile } from "@/src/lib/store/profile";
import { StoreDetailsForm } from "@/src/components/admin/store-details-form";

export default async function AdminSettingsPage() {
  await requireAdmin();
  const supabase = await createClient();

  const [{ count: productCount }, { count: orderCount }, { count: customerCount }, { count: featuredCount }, profile] =
    await Promise.all([
      supabase.from("products").select("id", { count: "exact", head: true }),
      supabase.from("orders").select("id", { count: "exact", head: true }),
      supabase.from("profiles").select("id", { count: "exact", head: true }),
      supabase.from("products").select("id", { count: "exact", head: true }).eq("is_featured", true),
      getStoreProfile(),
    ]);

  const tools = [
    {
      href: "/admin/settings/owners-manual",
      title: "Owner's Manual",
      body: "BADGER GHOST handover guide — setup, checkout, shipping, emergencies.",
    },
    {
      href: "/admin/settings/launch-catalog",
      title: "Launch catalog preview",
      body: `${featuredCount ?? 0} featured products ready for founder approval. Others stay visible until you approve hiding.`,
    },
    {
      href: "/admin/settings/handover",
      title: "Handover cleanup",
      body: "Phone-style checklist for demo/test records. Backup first. No deletes without approval.",
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <p className="text-[11px] font-medium uppercase tracking-[0.24em] text-[#b8964c]">Store</p>
        <h1 className="mt-2 text-3xl font-semibold text-[#173f35]">Settings</h1>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-2xl border border-[#173f35]/10 bg-white p-5">
          <p className="text-sm text-[#6b6b6b]">Products</p>
          <p className="mt-3 text-3xl font-semibold text-[#173f35]">{productCount ?? 0}</p>
        </div>
        <div className="rounded-2xl border border-[#173f35]/10 bg-white p-5">
          <p className="text-sm text-[#6b6b6b]">Orders</p>
          <p className="mt-3 text-3xl font-semibold text-[#173f35]">{orderCount ?? 0}</p>
        </div>
        <div className="rounded-2xl border border-[#173f35]/10 bg-white p-5">
          <p className="text-sm text-[#6b6b6b]">Customers</p>
          <p className="mt-3 text-3xl font-semibold text-[#173f35]">{customerCount ?? 0}</p>
        </div>
        <div className="rounded-2xl border border-[#173f35]/10 bg-white p-5">
          <p className="text-sm text-[#6b6b6b]">Featured launch</p>
          <p className="mt-3 text-3xl font-semibold text-[#173f35]">{featuredCount ?? 0}</p>
        </div>
      </div>

      <section className="grid gap-4 md:grid-cols-3">
        {tools.map((tool) => (
          <Link
            className="rounded-[28px] border border-[#173f35]/10 bg-white p-6 shadow-[0_12px_32px_rgba(23,63,53,0.04)] transition hover:border-[#b8964c]/50"
            href={tool.href}
            key={tool.href}
          >
            <p className="text-[11px] font-medium uppercase tracking-[0.2em] text-[#b8964c]">Handover</p>
            <h2 className="mt-2 text-xl font-semibold text-[#173f35]">{tool.title}</h2>
            <p className="mt-2 text-sm leading-6 text-[#6b6b6b]">{tool.body}</p>
          </Link>
        ))}
      </section>

      <StoreDetailsForm profile={profile} />
    </div>
  );
}
