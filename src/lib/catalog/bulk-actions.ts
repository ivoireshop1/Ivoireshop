"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/src/lib/auth/guards";
import { isBulkTargetSlug } from "@/src/lib/catalog/bulk-selection";
import { CANONICAL_CATEGORIES } from "@/src/lib/catalog/canonical-categories";

export type BulkMoveResult =
  | { success: true; moved: number; categoryName: string }
  | { success: false; error: string };

export async function bulkMoveCanonicalCategory(productIds: string[], targetSlug: string): Promise<BulkMoveResult> {
  const uniqueIds = [...new Set(productIds.filter(Boolean))];
  if (uniqueIds.length === 0) {
    return { success: false, error: "Select at least one product." };
  }
  if (!isBulkTargetSlug(targetSlug)) {
    return { success: false, error: "Choose Foods, Cosmetics, or Ivoire Market." };
  }

  const { supabase } = await requireAdmin();
  const { data, error } = await supabase.rpc("admin_bulk_move_canonical_category", {
    p_product_ids: uniqueIds,
    p_target_slug: targetSlug,
  });

  if (error) {
    return { success: false, error: error.message || "The category move could not be completed. Nothing was saved." };
  }

  const categoryName = CANONICAL_CATEGORIES.find((category) => category.slug === targetSlug)?.name ?? targetSlug;
  revalidatePath("/admin/products");
  revalidatePath("/admin/inventory");
  revalidatePath("/admin");
  revalidatePath("/");
  revalidatePath("/shop");
  revalidatePath("/categories");
  return { success: true, moved: Number(data) || uniqueIds.length, categoryName };
}

export type GlobalModifyResult = {
  success: boolean;
  saved: number;
  errors: Array<{ id: string; name?: string; error: string }>;
};

export async function applyGlobalModify(
  productIds: string[],
  draft: import("./global-modify").GlobalModifyDraft,
): Promise<GlobalModifyResult> {
  const uniqueIds = [...new Set(productIds.filter(Boolean))];
  if (!uniqueIds.length) return { success: false, saved: 0, errors: [{ id: "", error: "Select at least one product." }] };

  const { supabase } = await requireAdmin();
  const [{ data: products }, { data: categories }] = await Promise.all([
    supabase.from("products").select("id, name, category_id, subcategory_id, price, stock_quantity, is_active").in("id", uniqueIds),
    supabase.from("categories").select("id, parent_id"),
  ]);
  const { previewGlobalModify, globalModifyPatch } = await import("./global-modify");
  const preview = previewGlobalModify(products ?? [], uniqueIds, draft, categories ?? []);
  const errors: GlobalModifyResult["errors"] = [];
  let saved = 0;
  for (const row of preview) {
    if (row.error) {
      errors.push({ id: row.id, name: row.name, error: row.error });
      continue;
    }
    const patch = globalModifyPatch(draft);
    if (!Object.keys(patch).length) {
      errors.push({ id: row.id, name: row.name, error: "Choose at least one field to change." });
      continue;
    }
    const { error } = await supabase.from("products").update(patch).eq("id", row.id);
    if (error) errors.push({ id: row.id, name: row.name, error: "This product could not be saved." });
    else saved += 1;
  }
  revalidatePath("/admin/products");
  revalidatePath("/shop");
  revalidatePath("/");
  return { success: errors.length === 0 && saved > 0, saved, errors };
}
