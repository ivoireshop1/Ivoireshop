import Link from "next/link";
import Image from "next/image";
import { demoImages } from "@/src/lib/demo-images";

export function Hero() {
  return (
    <section className="mx-auto grid max-w-7xl gap-4 px-5 py-8 sm:py-12 lg:grid-cols-[1.1fr_1fr_0.7fr] lg:px-8 lg:py-14">
      <div aria-label="Customer shopping at Ivoire Shop" className="relative min-h-[330px] overflow-hidden rounded-2xl bg-[#e9ddc9] sm:min-h-[430px] lg:min-h-[500px]">
        <Image alt="A shopper holding groceries from Ivoire Shop" className="object-cover" fill priority sizes="(max-width: 1024px) 100vw, 38vw" src={demoImages.heroCustomer} />
        <p className="absolute bottom-5 left-5 max-w-24 font-serif text-2xl italic leading-tight text-forest-green">Better food, brighter days.</p>
      </div>
      <div className="flex flex-col justify-center px-2 py-6 lg:px-7">
        <p className="mb-5 text-xs font-semibold uppercase tracking-[0.22em] text-gold">African &amp; global products</p>
        <h1 className="max-w-xl font-serif text-5xl font-semibold leading-[1.03] tracking-tight text-forest-green sm:text-6xl">Your Favorite Products,<br />All in One Place.</h1>
        <p className="mt-6 max-w-lg text-base leading-7 text-muted">Shop quality African and international products, fresh groceries, pantry essentials, and everyday favorites — all from one trusted place.</p>
        <div className="mt-8 flex flex-col gap-3 sm:flex-row">
          <Link className="rounded-lg bg-forest-green px-6 py-3.5 text-center text-sm font-semibold text-white transition hover:bg-forest-green/90" href="/shop">Shop now <span aria-hidden="true">→</span></Link>
          <Link className="rounded-lg border border-forest-green px-6 py-3.5 text-center text-sm font-semibold text-forest-green transition hover:bg-forest-green/5" href="#categories">Explore categories</Link>
        </div>
      </div>
      <aside className="flex flex-col justify-center rounded-2xl border border-black/10 bg-surface p-6 shadow-sm lg:p-7">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-gold">Welcome to</p>
        <h2 className="mt-2 font-serif text-3xl font-semibold leading-tight text-forest-green">Ivoire Shop</h2>
        <p className="mt-3 text-sm leading-6 text-muted">Sign in to save your favorites, or browse freely as a guest.</p>
        <Link className="mt-6 rounded-lg bg-forest-green px-4 py-3 text-center text-sm font-semibold text-white" href="/login">Sign in</Link>
        <Link className="mt-2 rounded-lg border border-forest-green/30 px-4 py-3 text-center text-sm font-semibold text-forest-green" href="/signup">Create account</Link>
        <div className="my-5 flex items-center gap-3 text-xs text-muted"><span className="h-px flex-1 bg-black/10" />OR<span className="h-px flex-1 bg-black/10" /></div>
        <Link className="rounded-lg border border-black/15 px-4 py-3 text-center text-sm font-semibold text-forest-green" href="/shop">Shop as guest <span aria-hidden="true">→</span></Link>
      </aside>
    </section>
  );
}
