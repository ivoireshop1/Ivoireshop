import Link from "next/link";
import { Footer } from "@/src/components/layout/footer";
import { Header } from "@/src/components/layout/header";
import { PageHero } from "@/src/components/storefront/page-hero";
import { getProducts } from "@/src/lib/catalog/catalog";

export default async function CategoriesPage() {
  const products = await getProducts();
  const categories = [...new Map(products.map((product) => [product.category, product])).values()];
  return <><Header /><main>
    <PageHero eyebrow="The Ivoire collection" title="Explore Our Categories" description="Discover African and international products selected for your everyday needs." />
    <section className="mx-auto max-w-7xl px-5 py-14 lg:px-8">
      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {categories.map((product) => <Link className="group rounded-2xl border border-black/10 bg-surface p-4 transition hover:-translate-y-1 hover:border-gold/60" href={`/shop?category=${encodeURIComponent(product.category)}`} key={product.category}>
          <div className="flex aspect-[1.7] items-end rounded-xl bg-[#dce5d9] p-5"><h2 className="text-2xl font-semibold text-forest-green">{product.category}</h2></div>
          <div className="flex items-start justify-between gap-4 px-1 pb-1 pt-4"><div><p className="text-sm leading-6 text-muted">Browse products currently available in this category.</p></div><span aria-hidden="true" className="text-xl text-gold transition group-hover:translate-x-1">→</span></div>
          <span className="mt-3 inline-block px-1 text-sm font-semibold text-forest-green underline underline-offset-4">Explore</span>
        </Link>)}
      </div>
    </section>
  </main><Footer /></>;
}
