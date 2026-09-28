import Link from "next/link";
import { ProductGrid } from "@/src/components/product/product-grid";
import type { Product } from "@/src/types/catalog";

export function MerchProductRail({
  eyebrow,
  title,
  description,
  products,
  viewAllHref,
  viewAllLabel = "View all",
  comingSoon,
  compact,
}: {
  eyebrow: string;
  title: string;
  description: string;
  products: Product[];
  viewAllHref?: string;
  viewAllLabel?: string;
  comingSoon?: boolean;
  compact?: boolean;
}) {
  if (!products.length) return null;
  return (
    <section className={compact ? "py-10" : "mx-auto max-w-7xl px-5 py-10 lg:px-8"}>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-gold">{eyebrow}</p>
          <h2 className="mt-2 text-2xl font-semibold text-forest-green sm:text-3xl">{title}</h2>
          <p className="mt-2 max-w-xl text-sm leading-6 text-muted">{description}</p>
        </div>
        {viewAllHref ? (
          <Link className="min-h-11 text-sm font-semibold text-forest-green underline underline-offset-4" href={viewAllHref}>
            {viewAllLabel} →
          </Link>
        ) : null}
      </div>
      <div className="mt-6">
        <ProductGrid products={comingSoon ? products.map((product) => ({ ...product, isComingSoon: true })) : products} returnTo="/shop" />
      </div>
    </section>
  );
}
