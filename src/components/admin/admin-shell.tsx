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
  { href: "/admin/printing", label: "Printing" },
  { href: "/admin/delivery", label: "Delivery" },
  { href: "/admin/payments", label: "Payments" },
  { href: "/admin/customers", label: "Customers" },
  { href: "/admin/reviews", label: "Reviews" },
  { href: "/admin/announcements", label: "Announcements" },
  { href: "/admin/content", label: "Storefront / Promotions" },
  { href: "/admin/account", label: "Account/Security" },
  { href: "/", label: "View Store" },
];

export function AdminShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);

  if (pathname.startsWith("/admin/print")) {
    return <div className="min-h-screen bg-white text-black">{children}</div>;
  }

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
                  className={`flex min-h-11 items-center gap-2 rounded-xl px-3 py-2.5 text-sm font-medium ${current ? "bg-[#173f35]/10 text-[#173f35]" : "text-[#173f35]"}`}
                >
                  {item.href === "/admin/printing" ? <PrinterIcon /> : null}
                  {item.href === "/admin/delivery" ? <TruckIcon /> : null}
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

function PrinterIcon() {
  return (
    <svg aria-hidden="true" className="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24">
      <path d="M7 8V4h10v4M7 16H5a2 2 0 0 1-2-2v-4a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v4a2 2 0 0 1-2 2h-2M7 12h10v8H7v-8Z" stroke="currentColor" strokeWidth="1.6" />
    </svg>
  );
}

function TruckIcon() {
  return (
    <svg aria-hidden="true" className="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24">
      <path d="M3 7h11v10H3V7Zm11 3h5l2 3v4h-7V10ZM7 20a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3Zm10 0a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3Z" stroke="currentColor" strokeWidth="1.6" />
    </svg>
  );
}
