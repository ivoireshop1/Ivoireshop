"use client";

import Link from "next/link";
import { ReactNode, useState } from "react";
import { usePathname } from "next/navigation";
import LogoutButton from "@/src/components/auth/logout-button";

const navigation = [
  { href: "/admin", label: "Dashboard" },
  { href: "/admin/products", label: "Products" },
  { href: "/admin/products/catalog-controls", label: "Catalog Controls" },
  { href: "/admin/products/new", label: "Add Product" },
  { href: "/admin/categories", label: "Categories" },
  { href: "/admin/inventory", label: "Inventory" },
  { href: "/admin/orders", label: "Orders" },
  { href: "/admin/payments", label: "Payments" },
  { href: "/admin/customers", label: "Customers" },
  { href: "/admin/reviews", label: "Reviews" },
  { href: "/admin/content", label: "Storefront / Promotions" },
  { href: "/admin/account", label: "Account/Security" },
  { href: "/", label: "View Store" },
];

export function AdminShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <div className="min-h-screen overflow-x-hidden bg-[#f7f1e8] text-[#1a1a1a]">
      <div className="mx-auto flex max-w-[1600px] flex-col lg:flex-row">
        <aside className="border-b border-[#173f35]/10 bg-[#f5efe6] lg:min-h-screen lg:w-[280px] lg:shrink-0 lg:border-b-0 lg:border-r">
          <div className="flex items-center justify-between gap-3 border-b border-[#173f35]/10 px-4 py-4 sm:px-6">
            <div className="min-w-0">
              <p className="text-[11px] font-medium uppercase tracking-[0.22em] text-[#b8964c]">Ivoire Shop</p>
              <h1 className="mt-1 truncate text-lg font-semibold text-[#173f35] sm:text-xl">Admin</h1>
            </div>
            <button
              aria-expanded={menuOpen}
              className="min-h-11 rounded-lg border border-[#173f35]/20 px-3 text-sm text-[#173f35] lg:hidden"
              onClick={() => setMenuOpen((open) => !open)}
              type="button"
            >
              {menuOpen ? "Close" : "Menu"}
            </button>
          </div>

          <div className={`${menuOpen ? "block" : "hidden"} px-4 py-5 lg:block`}>
            <nav className="space-y-1" aria-label="Admin navigation">
              {navigation.map((item) => {
                const current =
                  item.href === "/admin/products"
                    ? pathname === "/admin/products" || (pathname.startsWith("/admin/products/") && !pathname.startsWith("/admin/products/catalog-controls") && pathname !== "/admin/products/new" && !pathname.startsWith("/admin/products/new/"))
                    : pathname === item.href || (item.href !== "/admin" && item.href !== "/" && pathname.startsWith(`${item.href}/`));
                return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setMenuOpen(false)}
                  aria-current={current ? "page" : undefined}
                  className={`flex min-h-11 items-center rounded-xl px-3 py-2.5 text-sm font-medium ${current ? "bg-[#173f35]/10 text-[#173f35]" : "text-[#173f35]"}`}
                >
                  {item.label}
                </Link>
                );
              })}
            </nav>
            <div className="mt-4 border-t border-[#173f35]/10 pt-2">
              <LogoutButton />
            </div>
          </div>
        </aside>

        <div className="min-w-0 flex-1">
          <main className="px-4 py-6 md:px-8">{children}</main>
        </div>
      </div>
    </div>
  );
}
