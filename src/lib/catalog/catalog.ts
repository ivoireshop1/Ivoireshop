import { cache } from "react";
import { createClient } from "@/src/lib/supabase/server";
import type { CatalogCategory, Product } from "@/src/types/catalog";
import { canonicalSortIndex } from "@/src/lib/catalog/canonical-categories";
import { toOneRelation } from "@/src/lib/catalog/relation-utils";

type ProductRow = {
  id: string;
  name: string;
  slug: string;
  description: string;
  short_description: string | null;
  price: number | string;
  compare_at_price: number | string | null;
  category_id: string;
  is_active: boolean;
  is_featured: boolean;
  is_new_arrival?: boolean;
  is_coming_soon?: boolean;
  stock_quantity: number | null;
  categories: { name: string } | { name: string }[] | null;
  product_images?: { image_url: string; position: number }[] | null;
};

function mapProduct(row: ProductRow): Product {
  const category = toOneRelation(row.categories)?.name || "Uncategorized";
  const image = row.product_images?.slice().sort((a, b) => a.position - b.position)[0]?.image_url;

  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    description: row.description,
    shortDescription: row.short_description ?? row.description,
    price: Number(row.price),
    compareAtPrice: row.compare_at_price === null ? undefined : Number(row.compare_at_price),
    category,
    image: image ?? "",
    weight: row.stock_quantity !== null ? `${row.stock_quantity} in stock` : "",
    stockQuantity: row.stock_quantity,
    isFeatured: row.is_featured,
    isNew: Boolean(row.is_new_arrival),
    isPopular: false,
    isComingSoon: Boolean(row.is_coming_soon) && !row.is_active,
  };
}

export async function getCategories(): Promise<CatalogCategory[]> {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("categories")
      .select("id, name, slug, description, image_url, is_active")
      .eq("is_active", true)
      .order("name");
    if (error) {
      console.error("Catalog categories query failed:", error.message);
      return [];
    }
    return (data ?? [])
      .map((category) => ({
        id: category.id,
        name: category.name,
        slug: category.slug,
        description: category.description,
        imageUrl: category.image_url,
        isActive: category.is_active,
      }))
      .sort((a, b) => canonicalSortIndex(a.name) - canonicalSortIndex(b.name) || a.name.localeCompare(b.name));
  } catch (error) {
    console.error("Catalog categories connection failed:", error);
    return [];
  }
}

export const getProducts = cache(async (): Promise<Product[]> => {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("products")
      .select("id, name, slug, description, short_description, price, compare_at_price, category_id, is_active, is_featured, is_new_arrival, is_coming_soon, stock_quantity, categories(name), product_images(image_url, position)")
      .eq("is_active", true)
      .order("created_at", { ascending: false });
    if (error) {
      throw new Error("Products could not be loaded.");
    }
    return (data as ProductRow[] | null ?? []).filter((product) => product.product_images?.length).map(mapProduct);
});

export async function getProductBySlug(slug: string): Promise<Product | undefined> {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("products")
      .select("id, name, slug, description, short_description, price, compare_at_price, category_id, is_active, is_featured, is_new_arrival, is_coming_soon, stock_quantity, categories(name), product_images(image_url, position)")
      .eq("slug", slug)
      .maybeSingle();
    if (error) {
      console.error("Catalog product query failed:", error.message);
      return undefined;
    }
    return data ? mapProduct(data as ProductRow) : undefined;
  } catch (error) {
    console.error("Catalog product connection failed:", error);
    return undefined;
  }
}

export async function getNewArrivalProducts(limit = 4): Promise<Product[]> {
  const products = await getProducts();
  return products.filter((product) => product.isNew && product.price > 0 && product.image).slice(0, limit);
}

export async function getComingSoonProducts(limit = 4): Promise<Product[]> {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("products")
      .select("id, name, slug, description, short_description, price, compare_at_price, category_id, is_active, is_featured, is_new_arrival, is_coming_soon, stock_quantity, categories(name), product_images(image_url, position)")
      .eq("is_coming_soon", true)
      .eq("is_active", false)
      .order("updated_at", { ascending: false })
      .limit(12);
    if (error) return [];
    return (data as ProductRow[] | null ?? [])
      .filter((row) => row.product_images?.length && !row.is_active && row.is_coming_soon)
      .map(mapProduct)
      .slice(0, limit);
  } catch {
    return [];
  }
}
