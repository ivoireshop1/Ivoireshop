"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/src/lib/auth/guards";
import { isPersistentImageUrl } from "@/src/lib/catalog/image-url";
import { isInventoryTracked } from "@/src/lib/catalog/inventory";
import { parsePriceInput, parseStockInput } from "@/src/lib/catalog/pricing-input";

function activationBlocker(product: {
  name: string | null;
  category_id: string | null;
  track_inventory?: boolean | null;
  product_images?: Array<{ image_url: string | null }> | null;
}, price: number | null, stock: number | null) {
  const hasImage = Array.isArray(product.product_images) && product.product_images.some((image) => {
    const url = image.image_url;
    return typeof url === "string" && isPersistentImageUrl(url);
  });
  if (!product.name?.trim()) return "Add a product name before activating this product.";
  if (!product.category_id) return "Add a category before activating this product.";
  if (price === null || !Number.isFinite(Number(price)) || Number(price) <= 0) {
    return "Add a valid price before activating this product.";
  }
  if (isInventoryTracked(product.track_inventory) && (stock === null || !Number.isInteger(Number(stock)) || Number(stock) < 0)) {
    return "Add a valid stock quantity before activating this product.";
  }
  if (!hasImage) return "Add at least one product image before activating this product.";
  return null;
}

export type ActionResult<T> = { success: true; data: T } | { success: false; error: string };

function revalidateStorefront(slug: string | null | undefined) {
  revalidatePath("/");
  revalidatePath("/shop");
  revalidatePath("/categories");
  revalidatePath("/admin");
  if (slug) revalidatePath(`/product/${slug}`);
}

export async function adminSetProductStatus(
  id: string,
  status: "active" | "sold_out" | "hidden",
): Promise<ActionResult<{ is_active: boolean; stock_quantity: number | null }>> {
  if (!id || !["active", "sold_out", "hidden"].includes(status)) {
    return { success: false, error: "Invalid status request." };
  }

  const { supabase } = await requireAdmin();
  const { data: product, error: fetchError } = await supabase
    .from("products")
    .select("id, name, slug, category_id, price, stock_quantity, track_inventory, needs_pricing, product_images(image_url)")
    .eq("id", id)
    .maybeSingle();

  if (fetchError || !product) {
    return { success: false, error: "Product not found." };
  }

  if (status !== "hidden") {
    const blocker = activationBlocker(product, product.price === null ? null : Number(product.price), product.stock_quantity === null ? null : Number(product.stock_quantity));
    if (blocker) return { success: false, error: blocker };
  }

  const nextValues = {
    is_active: status !== "hidden",
    stock_quantity: status === "sold_out" ? 0 : product.stock_quantity,
  };

  const { error } = await supabase.from("products").update(nextValues).eq("id", id);
  if (error) {
    return { success: false, error: "The status update failed. Try again." };
  }

  revalidateStorefront(product.slug);
  return { success: true, data: nextValues };
}

export async function adminSetFeatured(
  id: string,
  nextFeatured: boolean,
): Promise<ActionResult<{ is_featured: boolean }>> {
  if (!id) return { success: false, error: "Invalid product." };

  const { supabase } = await requireAdmin();
  const { data: product, error: fetchError } = await supabase
    .from("products")
    .select("id, slug")
    .eq("id", id)
    .maybeSingle();

  if (fetchError || !product) return { success: false, error: "Product not found." };

  const { error } = await supabase.from("products").update({ is_featured: nextFeatured }).eq("id", id);
  if (error) return { success: false, error: "Could not update featured state." };

  revalidateStorefront(product.slug);
  return { success: true, data: { is_featured: nextFeatured } };
}

export async function adminUpdateProductPricing(
  id: string,
  priceInput: string,
  stockInput: string,
  status?: "active" | "hidden",
): Promise<ActionResult<{ price: number | null; stock_quantity: number | null; needs_pricing: boolean; is_active: boolean }>> {
  if (!id) return { success: false, error: "Invalid product." };

  const parsedPrice = parsePriceInput(priceInput);
  const parsedStock = parseStockInput(stockInput);
  if (!parsedPrice.ok) return { success: false, error: parsedPrice.error };
  if (!parsedStock.ok) return { success: false, error: parsedStock.error };

  const { supabase } = await requireAdmin();
  const { data: product, error: fetchError } = await supabase
    .from("products")
    .select("id, name, slug, category_id, price, stock_quantity, track_inventory, is_active, product_images(image_url)")
    .eq("id", id)
    .maybeSingle();

  if (fetchError || !product) return { success: false, error: "Product not found." };

  const nextPrice = parsedPrice.value;
  const tracked = isInventoryTracked(product.track_inventory);
  const nextStock = tracked ? parsedStock.value : product.stock_quantity === null ? null : Number(product.stock_quantity);
  const needsPricing = nextPrice === null || nextPrice <= 0;
  let nextIsActive = needsPricing ? false : product.is_active;

  if (status === "hidden") nextIsActive = false;
  if (status === "active") {
    const blocker = activationBlocker(product, nextPrice, nextStock);
    if (blocker) return { success: false, error: blocker };
    nextIsActive = true;
  }

  const { error } = await supabase
    .from("products")
    .update({
      price: nextPrice,
      stock_quantity: nextStock,
      track_inventory: tracked,
      needs_pricing: needsPricing,
      is_active: nextIsActive,
    })
    .eq("id", id);

  if (error) return { success: false, error: "Could not save price/stock." };

  revalidateStorefront(product.slug);
  return { success: true, data: { price: nextPrice, stock_quantity: nextStock, needs_pricing: needsPricing, is_active: nextIsActive } };
}
