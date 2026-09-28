import Link from "next/link";
import { getCategories, getProducts } from "@/src/lib/catalog/catalog";
import { CanonicalCategoryCards } from "@/src/components/storefront/canonical-category-cards";

export async function CategorySection() {
  let categories: Awaited<ReturnType<typeof getCategories>> = [];
  let products: Awaited<ReturnType<typeof getProducts>> = [];
  try {
    [categories, products] = await Promise.all([getCategories(), getProducts()]);
  } catch {
    categories = [];
    products = [];
  }
  const liveNames = new Set(products.map((product) => product.category));

  return (
    <section className="mx-auto max-w-7xl px-5 py-16 lg:px-8" id="categories">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-gold">The Ivoire collection</p>
          <h2 className="mt-2 text-3xl font-semibold text-forest-green sm:text-4xl">Shop by category</h2>
        </div>
        <Link className="text-sm font-semibold text-forest-green underline underline-offset-4" href="/categories">
          View all categories →
        </Link>
      </div>
      <div className="mt-8">
        <CanonicalCategoryCards categories={categories} liveNames={liveNames} />
      </div>
    </section>
  );
}
