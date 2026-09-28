import { pageMetadata } from "@/src/lib/page-metadata";
import Link from "next/link";
import { Footer } from "@/src/components/layout/footer";
import { Header } from "@/src/components/layout/header";
import { PageHero } from "@/src/components/storefront/page-hero";
import { getCategories } from "@/src/lib/catalog/catalog";

export const dynamic = "force-dynamic";

export const metadata = pageMetadata("Categories", "Shop Cosmetics, Foods, and Ivoire Market.", "/categories");

export default async function CategoriesPage() {
  const categories = await getCategories();
  return <><Header /><main>
    <PageHero eyebrow="The Ivoire collection" title="Explore Our Categories" description="Shop Cosmetics, Foods, and Ivoire Market." />
    <section className="mx-auto max-w-7xl px-5 py-14 lg:px-8">
      {categories.length === 0 && <p className="py-12 text-center text-muted">No categories are available yet.</p>}
      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {categories.map((category) => <Link className="group rounded-2xl border border-black/10 bg-surface p-4" href={`/shop?category=${encodeURIComponent(category.name)}`} key={category.slug}>
          <div className="flex aspect-[1.7] items-end rounded-xl bg-[#dce5d9] p-5"><h2 className="break-words text-2xl font-semibold text-forest-green">{category.name}</h2></div>
          <div className="flex items-start justify-between gap-4 px-1 pb-1 pt-4"><p className="text-sm leading-6 text-muted">{category.description || "Browse products currently available in this category."}</p><span aria-hidden="true" className="text-xl text-gold">→</span></div>
        </Link>)}
      </div>
    </section>
  </main><Footer /></>;
}
