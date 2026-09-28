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
