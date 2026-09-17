import { requireAdmin } from "@/src/lib/auth/guards";
import { siteConfig } from "@/src/lib/site";
import { createClient } from "@/src/lib/supabase/server";

export default async function AdminSettingsPage() {
  await requireAdmin();
  const supabase = await createClient();

  const [{ count: productCount }, { count: orderCount }, { count: customerCount }] = await Promise.all([
    supabase.from("products").select("id", { count: "exact", head: true }),
    supabase.from("orders").select("id", { count: "exact", head: true }),
    supabase.from("profiles").select("id", { count: "exact", head: true }),
  ]);

  const settings = [
    { label: "Store name", value: siteConfig.name },
    { label: "Storefront URL", value: siteConfig.url },
    { label: "Default currency", value: process.env.NEXT_PUBLIC_DEFAULT_CURRENCY ?? "USD" },
    { label: "Support email", value: process.env.SUPPORT_EMAIL ?? "hello@ivoreshop.com" },
    { label: "Warehouse phone", value: process.env.SUPPORT_PHONE ?? "+1 (800) 555-0190" },
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
          <p className="text-sm text-[#6b6b6b]">Store status</p>
          <p className="mt-3 text-2xl font-semibold text-[#173f35]">Open</p>
        </div>
      </div>

      <section className="rounded-[28px] border border-[#173f35]/10 bg-white p-6 shadow-[0_12px_32px_rgba(23,63,53,0.04)]">
        <h2 className="text-xl font-semibold text-[#173f35]">Store details</h2>
        <div className="mt-4 space-y-3">
          {settings.map((setting) => (
            <div className="flex flex-col gap-1 rounded-2xl border border-[#173f35]/10 bg-[#f9f7f3] p-4 md:flex-row md:items-center md:justify-between" key={setting.label}>
              <span className="text-sm text-[#6b6b6b]">{setting.label}</span>
              <span className="text-sm font-medium text-[#173f35]">{setting.value}</span>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
