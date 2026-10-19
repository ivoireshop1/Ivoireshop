import Image from "next/image";
import Link from "next/link";
import { CANONICAL_CATEGORIES } from "@/src/lib/catalog/canonical-categories";
import { childrenOf, rootCategories, type CategoryNode } from "@/src/lib/catalog/category-tree";
import { isNextImageSrc } from "@/src/lib/catalog/image-url";

type StorefrontCategory = {
  id?: string;
  name: string;
  slug: string;
  imageUrl?: string | null;
  parentId?: string | null;
  sortOrder?: number | null;
};

function toNode(category: StorefrontCategory): CategoryNode {
  return {
    id: category.id ?? category.slug,
    name: category.name,
    slug: category.slug,
    image_url: category.imageUrl,
    parent_id: category.parentId ?? null,
    sort_order: category.sortOrder ?? 0,
  };
}

export function CanonicalCategoryCards({
  categories,
  productCounts = {},
}: {
  categories: StorefrontCategory[];
  /** Counts of live products by category/subcategory slug */
  productCounts?: Record<string, number>;
  /** @deprecated kept for callers; prefer productCounts */
  liveNames?: Set<string>;
}) {
  const nodes = categories.map(toNode);
  const roots = rootCategories(nodes);
  const preferred = CANONICAL_CATEGORIES.map((canonical) => {
    const match = roots.find((row) => row.slug === canonical.slug);
    return match ?? { id: canonical.slug, name: canonical.name, slug: canonical.slug, parent_id: null, sort_order: 0, image_url: null };
  });
  const extras = roots.filter((row) => !CANONICAL_CATEGORIES.some((canonical) => canonical.slug === row.slug));
  const cards = [...preferred, ...extras];

  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
      {cards.map((category) => {
        const subs = childrenOf(category.id, nodes);
        const count = productCounts[category.slug] ?? 0;
        return (
          <article
            className="rounded-[24px] border border-black/10 bg-[#fffdf9] p-3 shadow-[0_15px_30px_rgba(23,63,53,0.04)] transition duration-200 hover:border-gold/60"
            key={category.slug}
          >
            <Link className="group block" href={`/shop?category=${encodeURIComponent(category.slug)}`}>
              <div className="relative aspect-[4/3] overflow-hidden rounded-[18px] bg-[#dfe8df]">
                {category.image_url && isNextImageSrc(category.image_url) ? (
                  <Image alt={category.name} className="object-cover transition duration-300 group-hover:scale-105" fill sizes="(max-width: 640px) 90vw, 30vw" src={category.image_url} unoptimized />
                ) : (
                  <div className="flex h-full items-end p-5">
                    <span className="text-2xl font-semibold text-forest-green">{category.name}</span>
                  </div>
                )}
              </div>
              <p className="px-1 pt-3 text-sm font-semibold text-foreground">{category.name}</p>
              <p className="px-1 pb-1 pt-1 text-xs text-muted">
                {count > 0 ? `${count} product${count === 1 ? "" : "s"}` : "Browse this collection"}
              </p>
            </Link>
            {subs.length ? (
              <ul className="mt-2 flex flex-wrap gap-2 px-1 pb-1">
                {subs.map((sub) => (
                  <li key={sub.id}>
                    <Link
                      className="inline-flex min-h-9 items-center rounded-full border border-black/10 bg-white px-3 text-xs font-medium text-forest-green transition hover:border-gold/50"
                      href={`/shop?category=${encodeURIComponent(sub.slug)}`}
                    >
                      {sub.name}
                      {(productCounts[sub.slug] ?? 0) > 0 ? ` · ${productCounts[sub.slug]}` : ""}
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="px-1 pb-2 text-xs text-muted">No subcategories yet.</p>
            )}
          </article>
        );
      })}
    </div>
  );
}
