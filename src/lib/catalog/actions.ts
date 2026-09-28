"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/src/lib/auth/guards";
import { canonicalSlugForName, isAssignableCategory, isCanonicalSlug } from "@/src/lib/catalog/canonical-categories";
import { isPersistentImageUrl, productImagesObjectPath } from "@/src/lib/catalog/image-url";
import { resolvePersistedSku } from "@/src/lib/catalog/sku";
import { uniqueProductSlug } from "@/src/lib/catalog/product-slug";
import { nextOrderStatuses } from "@/src/lib/orders/status";

function textValue(formData: FormData, key: string) {
  return String(formData.get(key) ?? "").trim();
}

function slugify(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function moneyAmount(value: string) {
  if (!/^\d+(\.\d{1,2})?$/.test(value.trim())) return null;
  const number = Number(value);
  return Number.isFinite(number) && number >= 0 ? Number(number.toFixed(2)) : null;
}

function positiveNumber(value: string) {
  const number = Number(value);
  return Number.isFinite(number) && number >= 0 ? number : null;
}

export type SaveProductResult =
  | { success: true; id: string }
  | { success: false; code: string; error: string };

const SAVE_ERRORS: Record<string, string> = {
  product_required: "Enter a valid name, category, and price.",
  missing_name: "Add a product name before publishing.",
  missing_category: "Add a category before publishing.",
  missing_price: "Add a price before publishing.",
  missing_stock: "Add a valid stock quantity before publishing.",
  missing_image: "Add at least one product image before publishing.",
  product_save_failed: "The product could not be saved. Your entries were kept.",
};

function saveError(code: string): SaveProductResult {
  return { success: false, code, error: SAVE_ERRORS[code] ?? SAVE_ERRORS.product_save_failed };
}

export async function createCategory(formData: FormData) {
  const { supabase } = await requireAdmin();
  const name = textValue(formData, "name");
  const slug = slugify(textValue(formData, "slug") || name);

  if (!name || !slug) {
    redirect("/admin/categories?error=category_required");
  }

  if (canonicalSlugForName(name, slug)) {
    redirect("/admin/categories?error=canonical_duplicate");
  }

  const imageUrl = textValue(formData, "image_url") || null;
  if (imageUrl && !isPersistentImageUrl(imageUrl)) {
    redirect("/admin/categories?error=category_image_invalid");
  }

  const { error } = await supabase.from("categories").insert({
    name,
    slug,
    description: textValue(formData, "description") || null,
    image_url: imageUrl,
    is_active: formData.get("is_active") === "on",
  });

  if (error) {
    redirect(`/admin/categories?error=${error.code === "23505" ? "category_duplicate" : "category_create_failed"}`);
  }

  revalidatePath("/admin/categories");
  revalidatePath("/admin/products");
  revalidatePath("/categories");
  revalidatePath("/");
  redirect("/admin/categories?success=category_created");
}

export async function updateCategory(formData: FormData) {
  const { supabase } = await requireAdmin();
  const id = textValue(formData, "id");
  const name = textValue(formData, "name");
  const slug = slugify(textValue(formData, "slug") || name);

  if (!id || !name || !slug) {
    redirect("/admin/categories?error=category_required");
  }

  const { data: existing } = await supabase.from("categories").select("slug, image_url").eq("id", id).maybeSingle();
  if (existing && isCanonicalSlug(existing.slug) && (slug !== existing.slug || canonicalSlugForName(name, slug) !== existing.slug)) {
    redirect("/admin/categories?error=canonical_locked");
  }
  if (!existing?.slug && canonicalSlugForName(name, slug)) {
    redirect("/admin/categories?error=canonical_duplicate");
  }
  if (existing && !isCanonicalSlug(existing.slug) && canonicalSlugForName(name, slug)) {
    redirect("/admin/categories?error=canonical_duplicate");
  }

  const imageUrl = textValue(formData, "image_url") || null;
  if (imageUrl && !isPersistentImageUrl(imageUrl)) {
    redirect("/admin/categories?error=category_image_invalid");
  }

  const { error } = await supabase
    .from("categories")
    .update({
      name,
      slug,
      description: textValue(formData, "description") || null,
      image_url: imageUrl,
      is_active: formData.get("is_active") === "on",
    })
    .eq("id", id);

  if (error) {
    redirect("/admin/categories?error=category_update_failed");
  }

  const previousPath = existing?.image_url ? productImagesObjectPath(existing.image_url) : null;
  const nextPath = imageUrl ? productImagesObjectPath(imageUrl) : null;
  if (previousPath && previousPath !== nextPath) {
    await supabase.storage.from("product-images").remove([previousPath]);
  }

  revalidatePath("/admin/categories");
  revalidatePath("/admin/products");
  revalidatePath("/categories");
  revalidatePath("/");
  redirect("/admin/categories?success=category_updated");
}

export async function deleteCategory(formData: FormData) {
  const { supabase } = await requireAdmin();
  const id = textValue(formData, "id");

  if (!id) {
    redirect("/admin/categories?error=category_delete_failed");
  }

  const { data: existing } = await supabase.from("categories").select("slug").eq("id", id).maybeSingle();
  if (existing && isCanonicalSlug(existing.slug)) {
    redirect("/admin/categories?error=canonical_locked");
  }

  const { data: productUsage, error: usageError } = await supabase
    .from("products")
    .select("id")
    .eq("category_id", id)
    .limit(1);

  if (usageError) {
    redirect("/admin/categories?error=category_delete_failed");
  }

  if (productUsage && productUsage.length > 0) {
    redirect("/admin/categories?error=category_in_use");
  }

  const { error } = await supabase.from("categories").delete().eq("id", id);
  if (error) {
    redirect("/admin/categories?error=category_delete_failed");
  }

  revalidatePath("/admin/categories");
  revalidatePath("/admin/products");
  revalidatePath("/categories");
  revalidatePath("/");
  redirect("/admin/categories?success=category_deleted");
}

export async function deactivateCategory(formData: FormData) {
  const { supabase } = await requireAdmin();
  const id = textValue(formData, "id");
  if (!id) redirect("/admin/categories?error=category_delete_failed");

  const { data: existing } = await supabase.from("categories").select("slug").eq("id", id).maybeSingle();
  if (existing && isCanonicalSlug(existing.slug)) {
    redirect("/admin/categories?error=canonical_locked");
  }

  const { error } = await supabase.from("categories").update({ is_active: false }).eq("id", id);
  if (error) redirect("/admin/categories?error=category_update_failed");

  revalidatePath("/admin/categories");
  revalidatePath("/admin/products");
  revalidatePath("/categories");
  revalidatePath("/");
  redirect("/admin/categories?success=category_updated");
}

export async function saveProduct(formData: FormData): Promise<SaveProductResult> {
  const { supabase } = await requireAdmin();
  const id = textValue(formData, "id");
  const name = textValue(formData, "name");
  const slug = slugify(textValue(formData, "slug") || name);
  const categoryId = textValue(formData, "category_id");
  const description = textValue(formData, "description");
  const priceInput = textValue(formData, "price");
  const stockQuantityInput = textValue(formData, "stock_quantity");
  const trackInventory = formData.get("track_inventory") === "on";
  const price = priceInput ? moneyAmount(priceInput) : null;
  const stockQuantityValue = stockQuantityInput ? positiveNumber(stockQuantityInput) : null;
  const compareAtPriceValue = textValue(formData, "compare_at_price")
    ? moneyAmount(textValue(formData, "compare_at_price"))
    : null;
  const status = textValue(formData, "status") || "active";
  const isFeatured = formData.get("is_featured") === "on";
  const isNewArrival = formData.get("is_new_arrival") === "on";
  const isComingSoon = formData.get("is_coming_soon") === "on";
  const isDraft = formData.get("save_as_draft") === "true";

  if (
    !name ||
    !slug ||
    !categoryId ||
    (priceInput && price === null) ||
    (trackInventory && stockQuantityInput && (stockQuantityValue === null || !Number.isInteger(stockQuantityValue))) ||
    (textValue(formData, "compare_at_price") && compareAtPriceValue === null)
  ) {
    return saveError("product_required");
  }

  const { data: categoryRow } = await supabase
    .from("categories")
    .select("id, slug, is_active")
    .eq("id", categoryId)
    .maybeSingle();
  let currentCategoryId: string | null = null;
  let existingSku: string | null = null;
  if (id) {
    const { data: existing } = await supabase.from("products").select("category_id, sku").eq("id", id).maybeSingle();
    currentCategoryId = existing?.category_id ?? null;
    existingSku = existing?.sku ?? null;
  }
  if (!categoryRow || !isAssignableCategory(categoryRow, currentCategoryId)) {
    return saveError("missing_category");
  }

  const imagesJsonRaw = textValue(formData, "images_json");
  let imageUrls: string[] = [];
  if (imagesJsonRaw) {
    try {
      const parsed = JSON.parse(imagesJsonRaw);
      if (Array.isArray(parsed)) {
        imageUrls = parsed.filter((u): u is string => typeof u === "string" && Boolean(u.trim()));
      }
    } catch {
      // ignore JSON parse error
    }
  }
  if (imageUrls.length === 0) {
    imageUrls = [textValue(formData, "image_url"), ...textValue(formData, "gallery_images").split("\n")]
      .map((url) => url.trim())
      .filter(Boolean);
  }

  imageUrls = [...new Set(imageUrls.map((url) => url.trim()))];
  if (imageUrls.some((url) => !isPersistentImageUrl(url))) {
    return saveError("missing_image");
  }
  const wantsActive = !isDraft && status !== "hidden";

  if (!name || !slug) {
    return saveError("missing_name");
  }

  if (wantsActive) {
    if (!categoryId) return saveError("missing_category");
    if (price === null || price <= 0) return saveError("missing_price");
    if (trackInventory && (stockQuantityValue === null || stockQuantityValue < 0 || !Number.isInteger(stockQuantityValue))) {
      return saveError("missing_stock");
    }
    if (imageUrls.length === 0) return saveError("missing_image");
  }

  const hasCompletePricing = price !== null && price > 0;
  const isActive = wantsActive;
  const normalizedStockQuantity = !trackInventory ? null : status === "sold_out" ? 0 : stockQuantityValue;

  const { data: skuRows } = await supabase.from("products").select("id, sku, slug").not("sku", "is", null);
  const takenSkus = (skuRows ?? [])
    .filter((row) => !id || row.id !== id)
    .map((row) => String(row.sku ?? ""))
    .filter(Boolean);
  const { data: slugRows } = await supabase.from("products").select("id, slug");
  const takenSlugs = (slugRows ?? [])
    .filter((row) => !id || row.id !== id)
    .map((row) => String(row.slug ?? ""))
    .filter(Boolean);
  const uniqueSlug = uniqueProductSlug(slug, takenSlugs);
  const sku = id
    ? resolvePersistedSku({
        existingSku,
        submittedSku: textValue(formData, "sku"),
        categorySlug: categoryRow.slug,
        productId: id,
        takenSkus,
      }).sku
    : existingSku || textValue(formData, "sku") || null;

  const values = {
    name,
    slug: uniqueSlug,
    category_id: categoryId,
    description,
    short_description: textValue(formData, "short_description") || null,
    price,
    compare_at_price: compareAtPriceValue,
    sku,
    stock_quantity: normalizedStockQuantity,
    track_inventory: trackInventory,
    is_active: false,
    is_featured: isFeatured,
    is_new_arrival: isNewArrival,
    is_coming_soon: isComingSoon,
    needs_pricing: !hasCompletePricing,
  };

  const query = id
    ? supabase.from("products").update(values).eq("id", id).select("id").single()
    : supabase.from("products").insert(values).select("id").single();
  const { data: savedProduct, error } = await query;

  if (error) {
    return saveError("product_save_failed");
  }

  if (savedProduct) {
    const { data: oldImages, error: readImagesError } = await supabase
      .from("product_images")
      .select("id")
      .eq("product_id", savedProduct.id);
    if (readImagesError) return saveError("product_save_failed");
    const { error: insertImagesError } = imageUrls.length
      ? await supabase.from("product_images").insert(
          imageUrls.map((image_url, position) => ({
            product_id: savedProduct.id,
            image_url,
            alt_text: name,
            position,
          })),
        )
      : { error: null };
    if (insertImagesError) {
      return saveError("product_save_failed");
    }
    if (oldImages?.length) {
      const { error: deleteImagesError } = await supabase.from("product_images")
        .delete().eq("product_id", savedProduct.id).in("id", oldImages.map((image) => image.id));
      if (deleteImagesError) return saveError("product_save_failed");
    }
  }

  if (savedProduct && !sku) {
    const generated = resolvePersistedSku({
      existingSku: null,
      submittedSku: null,
      categorySlug: categoryRow.slug,
      productId: savedProduct.id,
      takenSkus,
    });
    if (generated.sku) {
      const { error: skuError } = await supabase.from("products").update({ sku: generated.sku }).eq("id", savedProduct.id);
      if (skuError) return saveError("product_save_failed");
    }
  }

  if (isActive && savedProduct) {
    const { error: publishError } = await supabase.from("products")
      .update({ is_active: true }).eq("id", savedProduct.id);
    if (publishError) return saveError("product_save_failed");
  }

  revalidatePath("/admin/products");
  revalidatePath("/admin/inventory");
  revalidatePath("/admin");
  revalidatePath("/");
  revalidatePath("/shop");
  revalidatePath("/categories");
  if (uniqueSlug) revalidatePath(`/product/${uniqueSlug}`);
  return { success: true, id: savedProduct?.id ?? id };
}

export async function duplicateProduct(formData: FormData) {
  const { supabase } = await requireAdmin();
  const id = textValue(formData, "id");

  if (!id) {
    redirect("/admin/products?error=product_duplicate_failed");
  }

  const { data: product, error: fetchError } = await supabase
    .from("products")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (fetchError || !product) {
    redirect("/admin/products?error=product_duplicate_failed");
  }

  const baseName = `${product.name} Copy`;
  const slugBase = slugify(`${product.slug}-copy`);
  const suffix = crypto.randomUUID().slice(0, 8);
  const nextSlug = `${slugBase}-${suffix}`;

  const { data: duplicatedProduct, error: insertError } = await supabase
    .from("products")
    .insert({
      name: baseName,
      slug: nextSlug,
      description: product.description ?? "",
      short_description: product.short_description,
      price: product.price,
      compare_at_price: product.compare_at_price,
      category_id: product.category_id,
      sku: product.sku ? `${product.sku}-copy` : null,
      stock_quantity: product.track_inventory === false ? product.stock_quantity : product.stock_quantity ?? 0,
      track_inventory: product.track_inventory !== false,
      is_active: product.is_active,
      is_featured: false,
    })
    .select("id")
    .single();

  if (insertError || !duplicatedProduct) {
    redirect("/admin/products?error=product_duplicate_failed");
  }

  const { data: images } = await supabase
    .from("product_images")
    .select("image_url, alt_text, position")
    .eq("product_id", id)
    .order("position", { ascending: true });

  if (images?.length) {
    const rows = images.map((image, index) => ({
      product_id: duplicatedProduct.id,
      image_url: image.image_url,
      alt_text: image.alt_text,
      position: index,
    }));
    await supabase.from("product_images").insert(rows);
  }

  revalidatePath("/admin/products");
  revalidatePath("/");
  redirect("/admin/products?success=product_duplicated");
}

export async function deleteProduct(formData: FormData) {
  const { supabase } = await requireAdmin();
  const id = textValue(formData, "id");

  if (!id) {
    redirect("/admin/products?error=product_delete_failed");
  }

  const { error } = await supabase.from("products").delete().eq("id", id);
  if (error) {
    redirect("/admin/products?error=product_delete_failed");
  }

  revalidatePath("/admin/products");
  revalidatePath("/");
  redirect("/admin/products?success=product_deleted");
}

export async function updateInventory(formData: FormData) {
  const { supabase } = await requireAdmin();
  const id = textValue(formData, "id");
  const stockQuantity = positiveNumber(textValue(formData, "stock_quantity"));

  if (!id || stockQuantity === null || !Number.isInteger(stockQuantity)) {
    redirect("/admin/inventory?error=invalid_stock");
  }

  const { data: product } = await supabase.from("products").select("track_inventory").eq("id", id).maybeSingle();
  if (!product || product.track_inventory === false) {
    redirect("/admin/inventory?error=inventory_not_tracked");
  }

  const { error } = await supabase
    .from("products")
    .update({ stock_quantity: stockQuantity })
    .eq("id", id);

  if (error) redirect("/admin/inventory?error=stock_update_failed");

  revalidatePath("/admin");
  revalidatePath("/admin/inventory");
  revalidatePath("/admin/products");
  revalidatePath("/");
  redirect("/admin/inventory?success=stock_updated");
}

export async function updateOrderStatus(formData: FormData) {
  const { supabase } = await requireAdmin();
  const id = textValue(formData, "id");
  const status = textValue(formData, "status");
  const validStatuses = ["pending", "confirmed", "processing", "ready_for_pickup", "shipped", "delivered", "cancelled"];

  if (!id || !validStatuses.includes(status)) {
    redirect("/admin/orders?error=invalid_status");
  }

  const { data: current, error: readError } = await supabase.from("orders")
    .select("status, fulfillment_method").eq("id", id).maybeSingle();
  if (readError || !current || textValue(formData, "expected_status") !== current.status
      || !nextOrderStatuses(current.status, current.fulfillment_method).includes(status)) {
    redirect(`/admin/orders/${id}?error=invalid_transition`);
  }
  const { data: changed, error } = await supabase.from("orders").update({ status })
    .eq("id", id).eq("status", current.status).select("id").maybeSingle();
  if (error || !changed) redirect(`/admin/orders/${id}?error=status_update_failed`);

  revalidatePath("/admin");
  revalidatePath("/admin/orders");
  revalidatePath(`/admin/orders/${id}`);
  revalidatePath("/account");
  revalidatePath(`/account/orders/${id}`);
  redirect(`/admin/orders/${id}?success=status_updated`);
}
