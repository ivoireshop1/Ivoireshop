import { createClient } from "@/src/lib/supabase/server";
import type { CatalogCategory, Product } from "@/src/types/catalog";

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
  stock_quantity: number | null;
  categories: { name: string }[] | null;
  product_images?: { image_url: string; position: number }[] | null;
};

function resolveCategoryName(name: string | null | undefined): Product["category"] {
  return name || "Uncategorized";
}

function mapProduct(row: ProductRow): Product {
  const category = resolveCategoryName(row.categories?.[0]?.name);
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
    isFeatured: row.is_featured,
    isNew: false,
    isPopular: false,
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
    return (data ?? []).map((category) => ({
      id: category.id,
      name: category.name,
      slug: category.slug,
      description: category.description,
      imageUrl: category.image_url,
      isActive: category.is_active,
    }));
  } catch (error) {
    console.error("Catalog categories connection failed:", error);
    return [];
  }
}

export async function getProducts(): Promise<Product[]> {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("products")
      .select("id, name, slug, description, short_description, price, compare_at_price, category_id, is_active, is_featured, stock_quantity, categories(name), product_images(image_url, position)")
      .eq("is_active", true)
      .order("created_at", { ascending: false });
    if (error) {
      console.error("Catalog products query failed:", error.message);
      return [];
    }
    return (data as ProductRow[] | null ?? []).filter((product) => product.product_images?.length).map(mapProduct);
  } catch (error) {
    console.error("Catalog products connection failed:", error);
    return [];
  }
}

export async function getProductBySlug(slug: string): Promise<Product | undefined> {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("products")
      .select("id, name, slug, description, short_description, price, compare_at_price, category_id, is_active, is_featured, stock_quantity, categories(name), product_images(image_url, position)")
      .eq("slug", slug)
      .eq("is_active", true)
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
