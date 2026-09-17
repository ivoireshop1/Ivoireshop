"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/src/lib/auth/guards";

export type ActionResult<T> = { success: true; data: T } | { success: false; error: string };

function revalidateStorefront(slug: string | null | undefined) {
  revalidatePath("/");
  revalidatePath("/shop");
  revalidatePath("/categories");
  revalidatePath("/admin/products");
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
    .select("id, slug, price, stock_quantity, needs_pricing, product_images(id)")
    .eq("id", id)
    .maybeSingle();

  if (fetchError || !product) {
    return { success: false, error: "Product not found." };
  }

  if (status !== "hidden") {
    const hasImage = Array.isArray(product.product_images) && product.product_images.length > 0;
    if (product.needs_pricing || product.price === null) {
      return { success: false, error: "Add a valid price before activating this product." };
    }
    if (product.stock_quantity === null) {
      return { success: false, error: "Add a valid stock quantity before activating this product." };
    }
    if (!hasImage) {
      return { success: false, error: "Add a product image before activating this product." };
    }
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
): Promise<ActionResult<{ price: number | null; stock_quantity: number | null; needs_pricing: boolean; is_active: boolean }>> {
  if (!id) return { success: false, error: "Invalid product." };

  const trimmedPrice = priceInput.trim();
  const trimmedStock = stockInput.trim();
  const price = trimmedPrice ? Number(trimmedPrice) : null;
  const stockQuantity = trimmedStock ? Number(trimmedStock) : null;

  if (trimmedPrice && (!Number.isFinite(price) || (price as number) <= 0)) {
    return { success: false, error: "Price must be a number greater than 0." };
  }
  if (trimmedStock && (!Number.isFinite(stockQuantity) || !Number.isInteger(stockQuantity) || (stockQuantity as number) < 0)) {
    return { success: false, error: "Stock must be a whole number of 0 or more." };
  }

  const { supabase } = await requireAdmin();
  const { data: product, error: fetchError } = await supabase
    .from("products")
    .select("id, slug, is_active")
    .eq("id", id)
    .maybeSingle();

  if (fetchError || !product) return { success: false, error: "Product not found." };

  const needsPricing = price === null || stockQuantity === null;
  // An active product must never end up with incomplete pricing/stock.
  const nextIsActive = needsPricing ? false : product.is_active;

  const { error } = await supabase
    .from("products")
    .update({ price, stock_quantity: stockQuantity, needs_pricing: needsPricing, is_active: nextIsActive })
    .eq("id", id);

  if (error) return { success: false, error: "Could not save price/stock." };

  revalidateStorefront(product.slug);
  return { success: true, data: { price, stock_quantity: stockQuantity, needs_pricing: needsPricing, is_active: nextIsActive } };
}
