"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/src/lib/auth/guards";
import { isPersistentImageUrl } from "@/src/lib/catalog/image-url";
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

function positiveNumber(value: string) {
  const number = Number(value);
  return Number.isFinite(number) && number >= 0 ? number : null;
}

export async function createCategory(formData: FormData) {
  const { supabase } = await requireAdmin();
  const name = textValue(formData, "name");
  const slug = slugify(textValue(formData, "slug") || name);

  if (!name || !slug) {
    redirect("/admin/categories?error=category_required");
  }

  const { error } = await supabase.from("categories").insert({
    name,
    slug,
    description: textValue(formData, "description") || null,
    image_url: textValue(formData, "image_url") || null,
    is_active: formData.get("is_active") === "on",
  });

  if (error) {
    redirect("/admin/categories?error=category_create_failed");
  }

  revalidatePath("/admin/categories");
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

  const { error } = await supabase
    .from("categories")
    .update({
      name,
      slug,
      description: textValue(formData, "description") || null,
      image_url: textValue(formData, "image_url") || null,
      is_active: formData.get("is_active") === "on",
    })
    .eq("id", id);

  if (error) {
    redirect("/admin/categories?error=category_update_failed");
  }

  revalidatePath("/admin/categories");
  revalidatePath("/");
  redirect("/admin/categories?success=category_updated");
}

export async function deleteCategory(formData: FormData) {
  const { supabase } = await requireAdmin();
  const id = textValue(formData, "id");

  if (!id) {
    redirect("/admin/categories?error=category_delete_failed");
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
  redirect("/admin/categories?success=category_deleted");
}

export async function saveProduct(formData: FormData) {
  const { supabase } = await requireAdmin();
  const id = textValue(formData, "id");
  const name = textValue(formData, "name");
  const slug = slugify(textValue(formData, "slug") || name);
  const categoryId = textValue(formData, "category_id");
  const description = textValue(formData, "description");
  const priceInput = textValue(formData, "price");
  const stockQuantityInput = textValue(formData, "stock_quantity");
  const price = priceInput ? positiveNumber(priceInput) : null;
  const stockQuantityValue = stockQuantityInput ? positiveNumber(stockQuantityInput) : null;
  const compareAtPriceValue = textValue(formData, "compare_at_price")
    ? positiveNumber(textValue(formData, "compare_at_price"))
    : null;
  const status = textValue(formData, "status") || "active";
  const isFeatured = formData.get("is_featured") === "on";
  const isDraft = formData.get("save_as_draft") === "true";

  if (
    !name ||
    !slug ||
    !categoryId ||
    (priceInput && price === null) ||
    (stockQuantityInput && (stockQuantityValue === null || !Number.isInteger(stockQuantityValue))) ||
    (textValue(formData, "compare_at_price") && compareAtPriceValue === null)
  ) {
    redirect(`${id ? `/admin/products/${id}` : "/admin/products/new"}?error=product_required`);
  }

  // Parse images from images_json or text inputs
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

  // Publishing Requirements validation for active products
  imageUrls = [...new Set(imageUrls.map((url) => url.trim()))];
  if (imageUrls.some((url) => !isPersistentImageUrl(url))) {
    redirect(`${id ? `/admin/products/${id}` : "/admin/products/new"}?error=missing_image`);
  }
  const wantsActive = !isDraft && status !== "hidden";

  if (!name || !slug) {
    redirect(`${id ? `/admin/products/${id}` : "/admin/products/new"}?error=missing_name`);
  }

  if (wantsActive) {
    if (!categoryId) {
      redirect(`${id ? `/admin/products/${id}` : "/admin/products/new"}?error=missing_category`);
    }
    if (price === null || price <= 0) {
      redirect(`${id ? `/admin/products/${id}` : "/admin/products/new"}?error=missing_price`);
    }
    if (stockQuantityValue === null || stockQuantityValue < 0 || !Number.isInteger(stockQuantityValue)) {
      redirect(`${id ? `/admin/products/${id}` : "/admin/products/new"}?error=missing_stock`);
    }
    if (imageUrls.length === 0) {
      redirect(`${id ? `/admin/products/${id}` : "/admin/products/new"}?error=missing_image`);
    }
  }

  const hasCompletePricing = price !== null && stockQuantityValue !== null && Number.isInteger(stockQuantityValue);
  const isActive = wantsActive;
  const normalizedStockQuantity = status === "sold_out" ? 0 : stockQuantityValue;

  const values = {
    name,
    slug,
    category_id: categoryId,
    description,
    short_description: textValue(formData, "short_description") || null,
    price,
    compare_at_price: compareAtPriceValue,
    sku: textValue(formData, "sku") || null,
    stock_quantity: normalizedStockQuantity,
    // Publish only after the persistent image records have been saved.
    is_active: false,
    is_featured: isFeatured,
    needs_pricing: !hasCompletePricing,
  };

  const query = id
    ? supabase.from("products").update(values).eq("id", id).select("id").single()
    : supabase.from("products").insert(values).select("id").single();
  const { data: savedProduct, error } = await query;

  if (error) {
    console.error("Product save database error:", error);
    redirect(`${id ? `/admin/products/${id}` : "/admin/products/new"}?error=product_save_failed`);
  }

  if (savedProduct) {
    const { data: oldImages, error: readImagesError } = await supabase
      .from("product_images")
      .select("id")
      .eq("product_id", savedProduct.id);
    if (readImagesError) redirect(`/admin/products/${savedProduct.id}?error=product_save_failed`);
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
      console.error("Product images save error:", insertImagesError);
      redirect(`${id ? `/admin/products/${id}` : "/admin/products/new"}?error=product_save_failed`);
    }
    if (oldImages?.length) {
      const { error: deleteImagesError } = await supabase.from("product_images")
        .delete().eq("product_id", savedProduct.id).in("id", oldImages.map((image) => image.id));
      if (deleteImagesError) redirect(`/admin/products/${savedProduct.id}?error=product_save_failed`);
    }
  }

  if (isActive && savedProduct) {
    const { error: publishError } = await supabase.from("products")
      .update({ is_active: true }).eq("id", savedProduct.id);
    if (publishError) redirect(`/admin/products/${savedProduct.id}?error=product_save_failed`);
  }

  revalidatePath("/admin/products");
  revalidatePath("/admin/inventory");
  revalidatePath("/admin");
  revalidatePath("/");
  revalidatePath("/shop");
  revalidatePath("/categories");
  if (slug) revalidatePath(`/product/${slug}`);
  redirect("/admin/products?success=product_saved");
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
      stock_quantity: product.stock_quantity ?? 0,
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
