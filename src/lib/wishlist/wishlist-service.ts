import { createClient } from "@/src/lib/supabase/browser";
import type { WishlistItem } from "@/src/types/wishlist";
import type { Product, ProductCategory } from "@/src/types/catalog";
import { productCategories } from "@/src/types/catalog";

type WishlistRow = {
  id: string;
  product_id: string;
  products: {
    id: string;
    name: string;
    slug: string;
    description: string;
    short_description: string | null;
    price: number | string;
    compare_at_price: number | string | null;
    is_featured: boolean;
    categories: { name: string }[] | null;
    product_images?: { image_url: string; position: number }[] | null;
  }[] | null;
};

export async function getWishlist(): Promise<WishlistItem[]> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];

  const { data, error } = await supabase
    .from("wishlist_items")
    .select("id, product_id, products(id, name, slug, description, short_description, price, compare_at_price, is_featured, categories(name), product_images(image_url, position))")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);

  return (data as WishlistRow[] | null ?? []).map((row) => {
    const productRow = row.products?.[0];
    const categoryName = productRow?.categories?.[0]?.name;
    const category: ProductCategory = productCategories.includes(categoryName as ProductCategory) ? categoryName as ProductCategory : "African Foods";
    const image = productRow?.product_images?.slice().sort((a: { position: number }, b: { position: number }) => a.position - b.position)[0]?.image_url ?? "/demo-products/premium-jasmine-rice.jpg";
    const product: Product | undefined = productRow ? {
      id: productRow.id,
      slug: productRow.slug,
      name: productRow.name,
      description: productRow.description,
      shortDescription: productRow.short_description ?? productRow.description,
      price: Number(productRow.price),
      compareAtPrice: productRow.compare_at_price === null ? undefined : Number(productRow.compare_at_price),
      category,
      image,
      weight: "",
      isFeatured: productRow.is_featured,
      isNew: false,
      isPopular: false,
    } : undefined;
    return { id: row.id, productId: row.product_id, product };
  });
}

export async function addToWishlist(productId: string) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Sign in to save products to your wishlist.");
  const { error } = await supabase
    .from("wishlist_items")
    .upsert({ user_id: user.id, product_id: productId }, { onConflict: "user_id,product_id", ignoreDuplicates: true });
  if (error) throw new Error(error.message);
}

export async function removeFromWishlist(productId: string) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Sign in to remove products from your wishlist.");
  const { error } = await supabase.from("wishlist_items").delete().eq("user_id", user.id).eq("product_id", productId);
  if (error) throw new Error(error.message);
}

export async function isWishlisted(productId: string) {
  const items = await getWishlist();
  return items.some((item) => item.productId === productId);
}
