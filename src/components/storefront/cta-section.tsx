import Link from "next/link";

export function CtaSection() {
  return <section className="mx-auto grid max-w-7xl gap-4 px-5 pb-16 lg:grid-cols-2 lg:px-8">
    <article className="flex min-h-48 flex-col justify-between rounded-2xl bg-[#eadbc4] p-7"><div><p className="text-xs font-semibold uppercase tracking-[0.18em] text-gold">Beauty &amp; self care</p><h2 className="mt-2 max-w-xs font-serif text-3xl font-semibold leading-tight text-forest-green">Natural Care<br />For Your Glow</h2><p className="mt-2 max-w-sm text-sm text-muted">Skincare, haircare, and beauty essentials for your everyday routine.</p></div><Link className="mt-5 w-fit rounded-lg bg-forest-green px-4 py-2.5 text-sm font-semibold text-white" href="/shop?category=African+Foods">Shop beauty <span aria-hidden="true">→</span></Link></article>
    <article className="flex min-h-48 flex-col justify-between rounded-2xl bg-[#2c1b13] p-7 text-white"><div><p className="text-xs font-semibold uppercase tracking-[0.18em] text-gold">Authentic African flavors</p><h2 className="mt-2 max-w-sm font-serif text-3xl font-semibold leading-tight">Spices That<br />Bring It All Together</h2><p className="mt-2 max-w-sm text-sm text-white/70">Pure, natural, and full of flavor.</p></div><Link className="mt-5 w-fit rounded-lg bg-gold px-4 py-2.5 text-sm font-semibold text-forest-green" href="/shop?category=Spices+%26+Seasoning">Shop spices <span aria-hidden="true">→</span></Link></article>
  </section>;
}
