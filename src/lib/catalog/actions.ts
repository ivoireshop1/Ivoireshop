"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/src/lib/auth/guards";

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
  const price = positiveNumber(textValue(formData, "price"));
  const stockQuantityValue = positiveNumber(textValue(formData, "stock_quantity"));
  const compareAtPriceValue = textValue(formData, "compare_at_price")
    ? positiveNumber(textValue(formData, "compare_at_price"))
    : null;

  if (
    !name ||
    !slug ||
    !categoryId ||
    !description ||
    price === null ||
    stockQuantityValue === null ||
    !Number.isInteger(stockQuantityValue) ||
    (textValue(formData, "compare_at_price") && compareAtPriceValue === null)
  ) {
    redirect("/admin/products/new?error=product_required");
  }

  const values = {
    name,
    slug,
    category_id: categoryId,
    description,
    short_description: textValue(formData, "short_description") || null,
    price,
    compare_at_price: compareAtPriceValue,
    sku: textValue(formData, "sku") || null,
    stock_quantity: stockQuantityValue,
    is_active: formData.get("is_active") === "on",
    is_featured: formData.get("is_featured") === "on",
  };

  const query = id
    ? supabase.from("products").update(values).eq("id", id)
    : supabase.from("products").insert(values);
  const { error } = await query;

  if (error) {
    redirect(`${id ? `/admin/products/${id}` : "/admin/products/new"}?error=product_save_failed`);
  }

  revalidatePath("/admin/products");
  revalidatePath("/");
  redirect("/admin/products?success=product_saved");
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
