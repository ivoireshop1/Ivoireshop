import Link from "next/link";
import { ProductGrid } from "@/src/components/product/product-grid";
import { demoProducts } from "@/src/lib/catalog/demo-products";

export function ProductSection() {
  const products = demoProducts.filter((product) => product.isFeatured || product.isPopular).slice(0, 4);

  return (
    <section className="bg-forest-green text-white" id="featured-products">
      <div className="mx-auto max-w-7xl px-5 py-16 lg:px-8">
        <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
          <div><p className="text-xs font-semibold uppercase tracking-[0.2em] text-gold">Featured products</p><h2 className="mt-2 text-3xl font-semibold text-white">Popular Right Now</h2></div>
          <Link className="rounded-full border border-white/40 px-4 py-2 text-sm font-semibold text-white hover:bg-white/10" href="/shop">View all products <span aria-hidden="true">→</span></Link>
        </div>
        <div className="mt-8"><ProductGrid products={products} returnTo="/shop" /></div>
      </div>
    </section>
  );
}
