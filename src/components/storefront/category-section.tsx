import Image from "next/image";
import Link from "next/link";
import { getCategories, getProducts } from "@/src/lib/catalog/catalog";
import { CANONICAL_CATEGORIES } from "@/src/lib/catalog/canonical-categories";

export async function CategorySection() {
  const [categories, products] = await Promise.all([getCategories(), getProducts()]);
  const byName = new Map(categories.map((category) => [category.name, category]));
  const liveNames = new Set(products.map((product) => product.category));
  const cards = CANONICAL_CATEGORIES.map((canonical) => byName.get(canonical.name) ?? {
    id: canonical.slug,
    name: canonical.name,
    slug: canonical.slug,
    description: null,
    imageUrl: null,
    isActive: true,
  });

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

      <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-3">
        {cards.map((category) => (
          <Link
            className="group rounded-[24px] border border-black/10 bg-[#fffdf9] p-3 shadow-[0_15px_30px_rgba(23,63,53,0.04)] transition duration-200 hover:-translate-y-1 hover:border-gold/60"
            href={`/shop?category=${encodeURIComponent(category.name)}`}
            key={category.slug}
          >
            <div className="relative aspect-[4/3] overflow-hidden rounded-[18px] bg-[#dfe8df]">
              {category.imageUrl ? (
                <Image alt={category.name} className="object-cover transition duration-300 group-hover:scale-105" fill sizes="(max-width: 640px) 90vw, 30vw" src={category.imageUrl} />
              ) : (
                <div className="flex h-full items-end p-5">
                  <span className="text-2xl font-semibold text-forest-green">{category.name}</span>
                </div>
              )}
            </div>
            <p className="px-1 pt-3 text-sm font-semibold text-foreground">{category.name}</p>
            <p className="px-1 pb-1 pt-1 text-xs text-muted">
              {liveNames.has(category.name) ? "Browse available products" : "Products coming soon"}
            </p>
          </Link>
        ))}
      </div>
    </section>
  );
}
