import { createClient } from "@/src/lib/supabase/server";
import { demoCategories } from "./demo-categories";
import { demoProducts, getDemoProduct } from "./demo-products";
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
  categories: { name: string }[] | null;
};

function fallbackCategories(): CatalogCategory[] {
  return demoCategories.map((category, index) => ({
    id: `demo-category-${index + 1}`,
    name: category.name,
    slug: category.filter.toLowerCase().replaceAll(" ", "-").replaceAll("&", "and"),
    description: category.description,
    imageUrl: category.image,
    isActive: true,
  }));
}

function mapProduct(row: ProductRow): Product {
  const category = row.categories?.[0]?.name;
  const knownCategory = demoProducts.find((product) => product.category === category)?.category ?? "African Foods";
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    description: row.description,
    shortDescription: row.short_description ?? row.description,
    price: Number(row.price),
    compareAtPrice: row.compare_at_price === null ? undefined : Number(row.compare_at_price),
    category: knownCategory,
    image: "/demo-products/premium-jasmine-rice.jpg",
    weight: "",
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
      return fallbackCategories();
    }
    if (!data?.length) return fallbackCategories();
    return data.map((category) => ({
      id: category.id,
      name: category.name,
      slug: category.slug,
      description: category.description,
      imageUrl: category.image_url,
      isActive: category.is_active,
    }));
  } catch (error) {
    console.error("Catalog categories connection failed:", error);
    return fallbackCategories();
  }
}

export async function getProducts(): Promise<Product[]> {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("products")
      .select("id, name, slug, description, short_description, price, compare_at_price, category_id, is_active, is_featured, categories(name)")
      .eq("is_active", true)
      .order("created_at", { ascending: false });
    if (error) {
      console.error("Catalog products query failed:", error.message);
      return demoProducts;
    }
    if (!data?.length) return demoProducts;
    return (data as ProductRow[]).map(mapProduct);
  } catch (error) {
    console.error("Catalog products connection failed:", error);
    return demoProducts;
  }
}

export async function getProductBySlug(slug: string): Promise<Product | undefined> {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("products")
      .select("id, name, slug, description, short_description, price, compare_at_price, category_id, is_active, is_featured, categories(name)")
      .eq("slug", slug)
      .eq("is_active", true)
      .maybeSingle();
    if (error) {
      console.error("Catalog product query failed:", error.message);
      return getDemoProduct(slug);
    }
    return data ? mapProduct(data as ProductRow) : getDemoProduct(slug);
  } catch (error) {
    console.error("Catalog product connection failed:", error);
    return getDemoProduct(slug);
  }
}
