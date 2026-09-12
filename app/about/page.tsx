import Link from "next/link";
import { Footer } from "@/src/components/layout/footer";
import { Header } from "@/src/components/layout/header";
import { PageHero } from "@/src/components/storefront/page-hero";

const values = [["Quality", "We carefully select products you can trust."], ["Authenticity", "Products and flavors that feel familiar and genuine."], ["Convenience", "Shop your essentials easily from one place."], ["Community", "Built around customers, families and everyday needs."]];

export default function AboutPage() {
  return <><Header /><main>
    <PageHero eyebrow="About Ivoire Shop" title="Bringing Good Food Closer to Home." description="Ivoire Shop brings together quality African and international products for customers looking for familiar flavors, everyday essentials, and new favorites." />
    <section className="mx-auto grid max-w-7xl gap-10 px-5 py-16 lg:grid-cols-2 lg:px-8"><div><p className="text-xs font-semibold uppercase tracking-[0.2em] text-gold">Our story</p><h2 className="mt-3 text-3xl font-semibold text-forest-green">A thoughtful way to shop for what feels like home.</h2></div><div className="space-y-4 text-base leading-7 text-muted"><p>Ivoire Shop exists to make quality African and international products easier to discover in one welcoming place.</p><p>We focus on a considered selection of pantry staples, fresh favorites, and everyday essentials so customers can shop with confidence and convenience.</p><p>Our goal is simple: bring familiar products closer to customers while making room for new discoveries along the way.</p></div></section>
    <section className="bg-[#f5f0e6]"><div className="mx-auto max-w-7xl px-5 py-16 lg:px-8"><p className="text-xs font-semibold uppercase tracking-[0.2em] text-gold">Our promise</p><div className="mt-8 grid gap-8 sm:grid-cols-2 lg:grid-cols-4">{values.map(([title, copy], index) => <div key={title}><span className="text-sm font-semibold text-gold">0{index + 1}</span><h2 className="mt-3 font-semibold uppercase tracking-wide text-forest-green">{title}</h2><p className="mt-2 text-sm leading-6 text-muted">{copy}</p></div>)}</div></div></section>
    <section className="mx-auto max-w-7xl px-5 py-16 text-center lg:px-8"><h2 className="text-3xl font-semibold text-forest-green">Ready to Explore?</h2><p className="mx-auto mt-3 max-w-md text-muted">Discover products selected for your everyday needs.</p><div className="mt-7 flex flex-wrap justify-center gap-3"><Link className="rounded-lg bg-forest-green px-5 py-3 text-sm font-semibold text-white" href="/shop">Shop Now</Link><Link className="rounded-lg border border-forest-green/20 px-5 py-3 text-sm font-semibold text-forest-green" href="/categories">Explore Categories</Link></div></section>
  </main><Footer /></>;
}
