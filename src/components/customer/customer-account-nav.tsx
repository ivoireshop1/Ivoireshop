import Link from "next/link";

const links = [
  { href: "/shop", label: "Shop" },
  { href: "/wishlist", label: "Wishlist" },
  { href: "/account/notifications", label: "Notifications" },
  { href: "/account#recent-orders", label: "Orders" },
  { href: "/account#security", label: "Security" },
];

export function CustomerAccountNav() {
  return (
    <nav aria-label="Customer account" className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
      {links.map((link) => (
        <Link
          className="flex min-h-11 items-center justify-center rounded-xl border border-forest-green/15 bg-white px-4 py-3 text-center text-sm font-semibold text-forest-green shadow-sm"
          href={link.href}
          key={link.href}
        >
          {link.label}
        </Link>
      ))}
    </nav>
  );
}
