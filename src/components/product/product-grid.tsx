import type { Product } from "@/src/types/catalog";
import { ProductCard } from "./product-card";

export function ProductGrid({ products, returnTo }: { products: Product[]; returnTo?: string }) {
  return <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 xl:grid-cols-4">{products.map((product) => <ProductCard key={product.id} product={product} returnTo={returnTo} />)}</div>;
}
