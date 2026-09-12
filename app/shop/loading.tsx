import { ProductSkeleton } from "@/src/components/product/product-skeleton";

export default function ShopLoading() {
  return <main className="mx-auto max-w-7xl px-5 py-12 lg:px-8"><div className="h-12 w-72 animate-pulse rounded bg-black/10" /><div className="mt-12 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">{Array.from({ length: 8 }, (_, index) => <ProductSkeleton key={index} />)}</div></main>;
}
