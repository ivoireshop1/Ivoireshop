import type { SupabaseClient } from "@supabase/supabase-js";
import type { Product } from "@/src/types/catalog";
import { toOneRelation } from "@/src/lib/catalog/relation-utils";

type ProductRow = {
  id: string;
  name: string;
  slug: string;
  description: string;
  short_description: string | null;
  price: number | string;
  compare_at_price: number | string | null;
  is_featured: boolean;
  stock_quantity: number | null;
  track_inventory?: boolean | null;
  categories: { name: string } | { name: string }[] | null;
  product_images?: { image_url: string; position: number }[] | null;
};

function mapProduct(productRow: ProductRow): Product {
  const category = toOneRelation(productRow.categories)?.name || "Uncategorized";
  const image = productRow.product_images?.slice().sort((a, b) => a.position - b.position)[0]?.image_url;
  return {
    id: productRow.id,
    slug: productRow.slug,
    name: productRow.name,
    description: productRow.description,
    shortDescription: productRow.short_description ?? productRow.description,
    price: Number(productRow.price),
    compareAtPrice: productRow.compare_at_price === null ? undefined : Number(productRow.compare_at_price),
    category,
    image: image ?? "",
    weight: "",
    stockQuantity: productRow.stock_quantity,
    trackInventory: productRow.track_inventory !== false,
    isFeatured: productRow.is_featured,
    isNew: false,
    isPopular: false,
  };
}

export async function getWishlistProductsForUser(supabase: SupabaseClient, userId: string, limit?: number) {
  let query = supabase
    .from("wishlist_items")
    .select("id, product_id")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });
  if (limit) query = query.limit(limit);

  const { data, error } = await query;
  if (error) throw new Error("Unable to load your wishlist.");

  const rows = data ?? [];
  const productIds = [...new Set(rows.map((row) => row.product_id))];
  const productsById = new Map<string, Product>();
  if (productIds.length) {
    const { data: products, error: productError } = await supabase
      .from("products")
      .select("id, name, slug, description, short_description, price, compare_at_price, is_featured, stock_quantity, track_inventory, categories(name), product_images(image_url, position)")
      .in("id", productIds);
    if (productError) throw new Error("Unable to load your wishlist.");
    for (const product of products ?? []) {
      productsById.set(product.id, mapProduct(product as ProductRow));
    }
  }

  return rows
    .map((row) => productsById.get(row.product_id))
    .filter((product): product is Product => Boolean(product));
}
