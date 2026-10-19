import type { Product } from "@/src/types/catalog";
import { ProductCard } from "./product-card";

export function ProductGrid({ products, returnTo }: { products: Product[]; returnTo?: string }) {
  return <div className="grid min-w-0 grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-6 xl:grid-cols-4">{products.map((product) => <ProductCard key={product.id} product={product} returnTo={returnTo} />)}</div>;
}
