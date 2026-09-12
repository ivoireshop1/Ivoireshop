import Link from "next/link";
import { NewsletterForm } from "./newsletter-form";

const groups = [
  { title: "Shop", links: [["Shop All", "/shop"], ["Categories", "/#categories"], ["Featured Products", "/#featured-products"], ["New Arrivals", "/shop"]] },
  { title: "Account", links: [["Sign In", "/login"], ["Create Account", "/signup"], ["My Account", "/account"]] },
  { title: "Company", links: [["About Us", "/about"], ["Blog", "/blog"], ["Contact", "/contact"]] },
  { title: "Support", links: [["Help", "/#support"], ["Delivery Information", "/#delivery"], ["Returns", "/#returns"], ["Privacy Policy", "/#privacy"], ["Terms & Conditions", "/#terms"]] },
];

export function Footer() {
  return (
    <footer className="border-t border-black/10 bg-forest-green text-white">
      <div className="mx-auto grid max-w-7xl gap-12 px-5 py-14 sm:grid-cols-2 lg:grid-cols-[1.3fr_repeat(4,1fr)] lg:px-8">
        <div>
          <Link className="text-lg font-semibold tracking-[0.18em]" href="/">IVOIRE <span className="font-normal">SHOP</span></Link>
          <p className="mt-4 max-w-xs text-sm leading-6 text-white/70">A thoughtful selection of African and international food products for your everyday table.</p>
        </div>
        {groups.map((group) => (
          <div key={group.title}>
            <h2 className="text-xs font-semibold uppercase tracking-[0.18em] text-gold">{group.title}</h2>
            <ul className="mt-4 space-y-3 text-sm text-white/75">
              {group.links.map(([label, href]) => <li key={label}><Link className="hover:text-white" href={href}>{label}</Link></li>)}
            </ul>
          </div>
        ))}
        <div id="contact">
          <h2 className="text-xs font-semibold uppercase tracking-[0.18em] text-gold">Join our newsletter</h2>
          <p className="mt-4 max-w-xs text-sm leading-6 text-white/70">Get exclusive deals, new arrivals, and more.</p>
          <NewsletterForm />
        </div>
      </div>
      <div className="border-t border-white/15">
        <div className="mx-auto flex max-w-7xl flex-col gap-3 px-5 py-5 text-xs text-white/60 sm:flex-row sm:items-center sm:justify-between lg:px-8">
          <span>© 2026 Ivoire Shop</span>
          <div className="flex gap-5"><Link href="#">Privacy Policy</Link><Link href="#">Terms &amp; Conditions</Link></div>
        </div>
      </div>
    </footer>
  );
}
