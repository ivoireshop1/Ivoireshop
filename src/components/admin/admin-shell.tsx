import Link from "next/link";
import { ReactNode } from "react";
import { requireAdmin } from "@/src/lib/auth/guards";

const navigation = [
  { href: "/admin", label: "Overview" },
  { href: "/admin/orders", label: "Orders" },
  { href: "/admin/products", label: "Products" },
  { href: "/admin/inventory", label: "Inventory" },
  { href: "/admin/customers", label: "Customers" },
  { href: "/admin/categories", label: "Categories" },
  { href: "/admin/content", label: "Content & Homepage" },
  { href: "/admin/analytics", label: "Analytics" },
  { href: "/admin/activity", label: "Activity Log" },
  { href: "/admin/store", label: "Store Settings" },
];

export async function AdminShell({ children }: { children: ReactNode }) {
  const { profile } = await requireAdmin();

  return (
    <div className="min-h-screen bg-[#f7f1e8] text-[#1a1a1a]">
      <div className="mx-auto flex max-w-[1600px] flex-col lg:flex-row">
        <aside className="border-b border-[#173f35]/10 bg-[#f5efe6] lg:min-h-screen lg:w-[280px] lg:border-b-0 lg:border-r">
          <div className="flex items-center justify-between border-b border-[#173f35]/10 px-6 py-5 lg:block">
            <div>
              <p className="text-[11px] font-medium uppercase tracking-[0.22em] text-[#b8964c]">Ivoire Shop</p>
              <h1 className="mt-2 text-xl font-semibold text-[#173f35]">Admin Command Center</h1>
            </div>
          </div>

          <div className="px-4 py-5">
            <div className="rounded-2xl border border-[#173f35]/10 bg-white/70 p-3 shadow-sm">
              <p className="text-[10px] font-medium uppercase tracking-[0.22em] text-[#6b6b6b]">Store status</p>
              <div className="mt-3 flex items-center justify-between gap-3">
                <span className="inline-flex items-center rounded-full bg-[#173f35] px-2.5 py-1 text-[11px] font-medium text-white">Open</span>
                <span className="text-xs text-[#6b6b6b]">Customers can shop</span>
              </div>
            </div>

            <nav className="mt-6 space-y-1" aria-label="Admin navigation">
              {navigation.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className="group flex items-center justify-between rounded-xl px-3 py-2.5 text-sm font-medium text-[#173f35] transition hover:bg-[#173f35]/5 hover:text-[#173f35]"
                >
                  <span>{item.label}</span>
                </Link>
              ))}
            </nav>
          </div>

          <div className="mt-auto border-t border-[#173f35]/10 px-4 py-4">
            <div className="flex items-center gap-3 rounded-2xl border border-[#173f35]/10 bg-white/80 p-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#173f35] text-sm font-semibold text-white">
                {profile.full_name?.slice(0, 1)?.toUpperCase() ?? "A"}
              </div>
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-[#173f35]">{profile.full_name || "Administrator"}</p>
                <p className="text-xs text-[#6b6b6b]">Store admin</p>
              </div>
            </div>
          </div>
        </aside>

        <div className="flex-1">
          <header className="border-b border-[#173f35]/10 bg-[#f7f1e8]">
            <div className="flex flex-col gap-4 px-4 py-4 md:flex-row md:items-center md:justify-between md:px-8">
              <div>
                <p className="text-[11px] font-medium uppercase tracking-[0.22em] text-[#b8964c]">Operations</p>
                <h2 className="mt-1 text-2xl font-semibold text-[#173f35]">Overview</h2>
              </div>

              <div className="flex items-center gap-3">
                <div className="hidden rounded-full border border-[#173f35]/10 bg-white/80 px-3 py-2 text-sm text-[#6b6b6b] md:block">
                  Search
                </div>
                <button className="rounded-full border border-[#173f35]/10 bg-white/80 px-3 py-2 text-sm text-[#173f35]">
                  Notifications
                </button>
                <button className="rounded-full border border-[#173f35]/10 bg-[#173f35] px-3 py-2 text-sm font-medium text-white">
                  {profile.full_name || "Admin"}
                </button>
              </div>
            </div>
          </header>

          <main className="px-4 py-6 md:px-8">{children}</main>
        </div>
      </div>
    </div>
  );
}
