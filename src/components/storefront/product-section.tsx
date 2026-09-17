import Link from "next/link";
import { ProductGrid } from "@/src/components/product/product-grid";
import { getProducts } from "@/src/lib/catalog/catalog";

export async function ProductSection() {
  const products = (await getProducts()).filter((product) => product.isFeatured).slice(0, 4);
  if (!products.length) return null;

  return (
    <section className="bg-forest-green text-white" id="featured-products">
      <div className="mx-auto max-w-7xl px-5 py-16 lg:px-8">
        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-gold">Featured products</p>
            <h2 className="mt-2 text-3xl font-semibold text-white">Featured products</h2>
          </div>

          <div className="flex flex-wrap items-center gap-3 text-sm text-white/80">
            <span className="rounded-full border border-white/25 bg-white/5 px-3 py-1.5">Available now</span>
          </div>
        </div>

        <div className="mt-8">
          <ProductGrid products={products} returnTo="/shop" />
        </div>

        <div className="mt-8 flex justify-center">
          <Link className="rounded-full border border-white/40 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-white/10" href="/shop">
            View all products <span aria-hidden="true">→</span>
          </Link>
        </div>
      </div>
    </section>
  );
}
