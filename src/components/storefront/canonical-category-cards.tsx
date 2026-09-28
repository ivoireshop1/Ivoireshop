import Image from "next/image";
import Link from "next/link";
import { CANONICAL_CATEGORIES } from "@/src/lib/catalog/canonical-categories";
import { isNextImageSrc } from "@/src/lib/catalog/image-url";

export function CanonicalCategoryCards({
  categories,
  liveNames,
}: {
  categories: Array<{ name: string; slug: string; imageUrl?: string | null }>;
  liveNames: Set<string>;
}) {
  const byName = new Map(categories.map((category) => [category.name, category]));
  const cards = CANONICAL_CATEGORIES.map((canonical) => {
    const match = byName.get(canonical.name);
    return {
      name: canonical.name,
      slug: canonical.slug,
      imageUrl: match?.imageUrl ?? null,
      hasProducts: liveNames.has(canonical.name),
    };
  });

  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
      {cards.map((category) => (
        <Link
          className="group rounded-[24px] border border-black/10 bg-[#fffdf9] p-3 shadow-[0_15px_30px_rgba(23,63,53,0.04)] transition duration-200 hover:-translate-y-1 hover:border-gold/60"
          href={`/shop?category=${encodeURIComponent(category.name)}`}
          key={category.slug}
        >
          <div className="relative aspect-[4/3] overflow-hidden rounded-[18px] bg-[#dfe8df]">
            {category.imageUrl && isNextImageSrc(category.imageUrl) ? (
              <Image alt={category.name} className="object-cover transition duration-300 group-hover:scale-105" fill sizes="(max-width: 640px) 90vw, 30vw" src={category.imageUrl} unoptimized />
            ) : (
              <div className="flex h-full items-end p-5">
                <span className="text-2xl font-semibold text-forest-green">{category.name}</span>
              </div>
            )}
          </div>
          <p className="px-1 pt-3 text-sm font-semibold text-foreground">{category.name}</p>
          <p className="px-1 pb-1 pt-1 text-xs text-muted">
            {category.hasProducts ? "Browse available products" : "Products coming soon"}
          </p>
        </Link>
      ))}
    </div>
  );
}
