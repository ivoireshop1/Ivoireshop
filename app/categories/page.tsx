import Image from "next/image";
import Link from "next/link";
import { Footer } from "@/src/components/layout/footer";
import { Header } from "@/src/components/layout/header";
import { PageHero } from "@/src/components/storefront/page-hero";
import { demoCategories } from "@/src/lib/catalog/demo-categories";

export default function CategoriesPage() {
  return <><Header /><main>
    <PageHero eyebrow="The Ivoire collection" title="Explore Our Categories" description="Discover African and international products selected for your everyday needs." />
    <section className="mx-auto max-w-7xl px-5 py-14 lg:px-8">
      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {demoCategories.map((category) => <Link className="group rounded-2xl border border-black/10 bg-surface p-4 transition hover:-translate-y-1 hover:border-gold/60" href={`/shop?category=${encodeURIComponent(category.filter)}`} key={category.name}>
          <div className="relative aspect-[1.7] overflow-hidden rounded-xl bg-[#dce5d9]"><Image alt={category.name} className="object-cover transition duration-300 group-hover:scale-105" fill sizes="(max-width: 640px) 90vw, (max-width: 1024px) 45vw, 30vw" src={category.image} /></div>
          <div className="flex items-start justify-between gap-4 px-1 pb-1 pt-4"><div><h2 className="font-semibold text-forest-green">{category.name}</h2><p className="mt-2 text-sm leading-6 text-muted">{category.description}</p></div><span aria-hidden="true" className="text-xl text-gold transition group-hover:translate-x-1">→</span></div>
          <span className="mt-3 inline-block px-1 text-sm font-semibold text-forest-green underline underline-offset-4">Explore</span>
        </Link>)}
      </div>
    </section>
  </main><Footer /></>;
}
