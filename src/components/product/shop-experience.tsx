"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { demoProducts } from "@/src/lib/catalog/demo-products";
import { CategoryFilter } from "@/src/components/product/category-filter";
import { ProductGrid } from "@/src/components/product/product-grid";
import { ProductSearch } from "@/src/components/product/product-search";

type ShopExperienceProps = {
  initialCategory?: string;
  initialSearch?: string;
};

export function ShopExperience({ initialCategory = "All Products", initialSearch = "" }: ShopExperienceProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [query, setQuery] = useState(initialSearch);
  const [category, setCategory] = useState(initialCategory);
  const products = useMemo(() => demoProducts.filter((product) => {
    const matchesCategory = category === "All Products" || product.category === category;
    const text = `${product.name} ${product.category}`.toLowerCase();
    return matchesCategory && text.includes(query.toLowerCase().trim());
  }), [category, query]);

  useEffect(() => {
    const params = new URLSearchParams();
    if (category !== "All Products") params.set("category", category);
    if (query.trim()) params.set("search", query.trim());
    const queryString = params.toString();
    router.replace(queryString ? `/shop?${queryString}` : "/shop", { scroll: false });
  }, [category, query, router]);

  function clearFilters() {
    setQuery("");
    setCategory("All Products");
  }

  return <main className="mx-auto max-w-7xl px-5 py-12 lg:px-8">
    <Link aria-label="Back to home" className="mb-5 inline-flex min-h-10 items-center rounded-lg px-3 py-2 text-sm font-medium text-forest-green transition hover:bg-forest-green/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-gold" href="/"><span aria-hidden="true" className="mr-2 text-lg">←</span>Back to home</Link>
    <div className="relative isolate overflow-hidden rounded-3xl bg-forest-green px-6 py-14 sm:px-10 sm:py-20">
      <Image alt="" className="absolute inset-0 -z-10 object-cover opacity-75" fill priority sizes="(max-width: 1280px) 100vw, 1200px" src="/demo-products/premium-jasmine-rice.jpg" />
      <div className="absolute inset-0 -z-10 bg-forest-green/35" />
      <div className="relative max-w-2xl"><p className="text-xs font-semibold uppercase tracking-[0.2em] text-gold">The Ivoire collection</p><h1 className="mt-3 font-serif text-4xl font-semibold text-white sm:text-5xl">Shop Everyday Favorites</h1><p className="mt-4 max-w-xl leading-7 text-white/80">Discover quality African and international groceries selected for your everyday kitchen.</p></div>
    </div>
    <div className="mt-10 space-y-4"><ProductSearch value={query} onChange={setQuery} /><CategoryFilter value={category} onChange={setCategory} /></div>
    {products.length > 0 ? <div className="mt-10"><ProductGrid products={products} returnTo={`${pathname}${searchParams.toString() ? `?${searchParams.toString()}` : ""}`} /></div> : <div className="py-24 text-center"><h2 className="text-2xl font-semibold text-forest-green">No products found</h2><p className="mt-3 text-muted">Try adjusting your search or browsing another category.</p><button className="mt-6 rounded-lg bg-forest-green px-5 py-3 text-sm font-semibold text-white" onClick={clearFilters} type="button">Clear filters</button></div>}
  </main>;
}
