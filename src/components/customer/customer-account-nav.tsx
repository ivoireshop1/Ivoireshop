import Link from "next/link";
import LogoutButton from "@/src/components/auth/logout-button";

const links = [
  { href: "/account", label: "Overview" },
  { href: "/account#recent-orders", label: "Orders" },
  { href: "/wishlist", label: "Wishlist" },
  { href: "/account#security", label: "Security" },
];

export function CustomerAccountNav() {
  return (
    <nav aria-label="Customer account" className="mb-6 flex flex-wrap items-center gap-2">
      {links.map((link) => (
        <Link
          className="min-h-11 rounded-full border border-forest-green/15 bg-white px-4 py-2 text-sm font-semibold text-forest-green"
          href={link.href}
          key={link.href}
        >
          {link.label}
        </Link>
      ))}
      <LogoutButton className="" />
    </nav>
  );
}
