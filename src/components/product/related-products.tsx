import type { Product } from "@/src/types/catalog";
import { ProductGrid } from "./product-grid";

export function RelatedProducts({ products, returnTo }: { products: Product[]; returnTo?: string }) {
  return <section className="mt-20 border-t border-black/10 pt-12"><h2 className="text-2xl font-semibold text-forest-green">You may also like</h2><div className="mt-8"><ProductGrid products={products.slice(0, 4)} returnTo={returnTo} /></div></section>;
}
