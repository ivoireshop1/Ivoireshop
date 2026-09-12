import Link from "next/link";
import { requireAdmin } from "@/src/lib/auth/guards";

const navigation = [
  { href: "/admin", label: "Overview" },
  { href: "/admin/products", label: "Products" },
  { href: "/admin/categories", label: "Categories" },
  { href: "/admin/orders", label: "Orders" },
  { href: "/admin/customers", label: "Customers" },
];

export default async function AdminLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const { profile } = await requireAdmin();

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-black/10 bg-surface">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-5">
          <Link className="text-xl font-semibold text-forest-green" href="/admin">
            Ivoire Shop Admin
          </Link>
          <span className="text-sm text-muted">
            {profile.full_name || "Administrator"}
          </span>
        </div>
      </header>
      <div className="mx-auto flex max-w-7xl flex-col gap-8 px-6 py-8 md:flex-row">
        <nav aria-label="Admin navigation" className="w-full md:w-52">
          <ul className="space-y-1">
            {navigation.map((item) => (
              <li key={item.href}>
                <Link
                  className="block rounded-lg px-3 py-2 text-sm font-medium text-forest-green hover:bg-forest-green/10"
                  href={item.href}
                >
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
        <main className="min-w-0 flex-1">{children}</main>
      </div>
    </div>
  );
}
