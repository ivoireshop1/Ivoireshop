import Link from "next/link";
import { NewsletterForm } from "./newsletter-form";

const groups = [
  { title: "Shop", links: [["Shop All", "/shop"], ["Categories", "/categories"], ["Featured Products", "/#featured-products"], ["New Arrivals", "/shop?arrival=new"]] },
  { title: "Account", links: [["Sign In", "/login"], ["Create Account", "/signup"], ["My Account", "/account"], ["Track My Order", "/orders"]] },
  { title: "Company", links: [["About Us", "/about"], ["Blog", "/blog"], ["Contact", "/contact"]] },
  { title: "Support", links: [["Track My Order", "/orders"], ["Shopping information", "/contact"]] },
];

export function Footer() {
  return (
    <footer className="min-w-0 max-w-[100vw] overflow-x-clip border-t border-black/10 bg-forest-green text-white pb-[env(safe-area-inset-bottom,0)]">
      <div className="mx-auto grid min-w-0 max-w-7xl gap-8 px-4 py-10 sm:grid-cols-2 sm:gap-12 sm:px-5 sm:py-14 lg:grid-cols-[1.3fr_repeat(4,minmax(0,1fr))] lg:px-8">
        <div className="min-w-0">
          <Link className="text-lg font-semibold tracking-[0.18em]" href="/">IVOIRE <span className="font-normal">SHOP</span></Link>
          <p className="mt-4 max-w-xs text-sm leading-6 text-white/70">A thoughtful selection of African and international food products for your everyday table.</p>
        </div>
        {groups.map((group) => (
          <div className="min-w-0" key={group.title}>
            <h2 className="text-xs font-semibold uppercase tracking-[0.18em] text-gold">{group.title}</h2>
            <ul className="mt-4 space-y-3 text-sm text-white/75">
              {group.links.map(([label, href]) => <li key={label}><Link className="break-words hover:text-white" href={href}>{label}</Link></li>)}
            </ul>
          </div>
        ))}
        <div className="min-w-0" id="contact">
          <h2 className="text-xs font-semibold uppercase tracking-[0.18em] text-gold">Join our newsletter</h2>
          <p className="mt-4 max-w-xs text-sm leading-6 text-white/70">Newsletter signup is not yet available.</p>
          <NewsletterForm />
        </div>
      </div>
      <div className="border-t border-white/15">
        <div className="mx-auto flex min-w-0 max-w-7xl flex-col gap-3 px-4 py-5 text-xs text-white/60 sm:flex-row sm:items-center sm:justify-between sm:px-5 lg:px-8">
          <span>© 2026 Ivoire Shop</span>
          <Link href="/contact">Shopping information</Link>
        </div>
      </div>
    </footer>
  );
}
