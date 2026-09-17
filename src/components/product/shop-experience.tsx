"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { CategoryFilter } from "@/src/components/product/category-filter";
import { ProductGrid } from "@/src/components/product/product-grid";
import { ProductSearch } from "@/src/components/product/product-search";
import { createClient } from "@/src/lib/supabase/browser";
import type { Product } from "@/src/types/catalog";

type ShopExperienceProps = {
  initialCategory?: string;
  initialSearch?: string;
};

type ProductRow = {
  id: string;
  slug: string;
  name: string;
  description: string;
  short_description: string | null;
  price: number | string;
  compare_at_price: number | string | null;
  is_featured: boolean;
  stock_quantity: number | null;
  categories?: Array<{ name: string | null }> | null;
  product_images?: Array<{ image_url: string; position: number }> | null;
};

export function ShopExperience({ initialCategory = "All", initialSearch = "" }: ShopExperienceProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [query, setQuery] = useState(initialSearch);
  const [category, setCategory] = useState(initialCategory === "All Products" ? "All" : initialCategory || "All");
  const [products, setProducts] = useState<Product[]>([]);

  useEffect(() => {
    const loadProducts = async () => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("products")
        .select("id, name, slug, description, short_description, price, compare_at_price, is_featured, stock_quantity, categories(name), product_images(image_url, position)")
        .eq("is_active", true)
        .order("created_at", { ascending: false });

      if (error || !data) {
        setProducts([]);
        return;
      }

      setProducts((data as ProductRow[]).filter((row) => row.product_images?.length).map((row) => ({
        id: row.id,
        slug: row.slug,
        name: row.name,
        description: row.description,
        shortDescription: row.short_description ?? row.description,
        price: Number(row.price),
        compareAtPrice: row.compare_at_price === null ? undefined : Number(row.compare_at_price),
        category: row.categories?.[0]?.name ?? "Uncategorized",
        image: row.product_images?.slice().sort((a: { position: number }, b: { position: number }) => a.position - b.position)[0]?.image_url ?? "",
        weight: row.stock_quantity !== null ? `${row.stock_quantity} in stock` : "",
        isFeatured: Boolean(row.is_featured),
        isNew: false,
        isPopular: false,
      })));
    };

    void loadProducts();
  }, []);

  const activeCategories = useMemo(() => [...new Set(products.map((product) => product.category))].sort(), [products]);
  const normalizedProducts = useMemo(() => products.filter((product) => {
    const matchesCategory = category === "All" || product.category === category;
    const text = `${product.name} ${product.category}`.toLowerCase();
    return matchesCategory && text.includes(query.toLowerCase().trim());
  }), [category, products, query]);

  useEffect(() => {
    const params = new URLSearchParams();
    if (category !== "All") params.set("category", category);
    if (query.trim()) params.set("search", query.trim());
    const queryString = params.toString();
    if (queryString !== searchParams.toString()) {
      router.replace(queryString ? `/shop?${queryString}` : "/shop", { scroll: false });
    }
  }, [category, query, router, searchParams]);

  function clearFilters() {
    setQuery("");
    setCategory("All");
  }

  return <main className="mx-auto max-w-7xl px-5 py-12 lg:px-8">
    <Link aria-label="Back to home" className="mb-5 inline-flex min-h-10 items-center rounded-lg px-3 py-2 text-sm font-medium text-forest-green transition hover:bg-forest-green/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-gold" href="/"><span aria-hidden="true" className="mr-2 text-lg">←</span>Back to home</Link>
    <div className="rounded-3xl bg-forest-green px-6 py-14 sm:px-10 sm:py-20">
      <div className="max-w-2xl"><p className="text-xs font-semibold uppercase tracking-[0.2em] text-gold">The Ivoire collection</p><h1 className="mt-3 font-serif text-4xl font-semibold text-white sm:text-5xl">Shop the live catalog</h1><p className="mt-4 max-w-xl leading-7 text-white/80">Browse products currently available from the store.</p></div>
    </div>
    <div className="mt-10 space-y-4"><ProductSearch value={query} onChange={setQuery} />{activeCategories.length > 0 && <CategoryFilter categories={activeCategories} value={category} onChange={setCategory} />}</div>
    {normalizedProducts.length > 0 ? <div className="mt-10"><ProductGrid products={normalizedProducts} returnTo={`${pathname}${searchParams.toString() ? `?${searchParams.toString()}` : ""}`} /></div> : <div className="py-24 text-center"><h2 className="text-2xl font-semibold text-forest-green">Products are being prepared</h2><p className="mt-3 text-muted">Check back soon for products available to shop.</p>{(query || category !== "All") && <button className="mt-6 rounded-lg bg-forest-green px-5 py-3 text-sm font-semibold text-white" onClick={clearFilters} type="button">Clear filters</button>}</div>}
  </main>;
}
