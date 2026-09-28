"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/src/lib/auth/guards";
import {
  CLEAR_PRICES_PHRASE,
  confirmationMatches,
  FRESH_START_PHRASE,
  parseCatalogImpact,
  parseCatalogSnapshotMeta,
  RESTORE_PHRASE,
  type CatalogImpact,
  type CatalogSnapshotMeta,
} from "@/src/lib/catalog/catalog-reset";
import { parsePriceInput } from "@/src/lib/catalog/pricing-input";

export type CatalogResetResult =
  | { success: true; updated: number; impact: CatalogImpact }
  | { success: false; error: string };

function revalidateCatalogSurfaces() {
  revalidatePath("/");
  revalidatePath("/shop");
  revalidatePath("/categories");
  revalidatePath("/admin");
  revalidatePath("/admin/products");
  revalidatePath("/admin/products/catalog-controls");
  revalidatePath("/admin/inventory");
}

function rpcError(message: string | undefined, fallback: string) {
  return message?.trim() || fallback;
}

export async function loadCatalogControlState(): Promise<{
  impact: CatalogImpact;
  snapshot: CatalogSnapshotMeta | null;
}> {
  const { supabase } = await requireAdmin();
  const [{ data: impactData, error: impactError }, { data: snapshotData, error: snapshotError }] = await Promise.all([
    supabase.rpc("admin_catalog_impact"),
    supabase.rpc("admin_latest_catalog_snapshot_meta"),
  ]);

  if (impactError) {
    throw new Error("Unable to load catalog impact counts.");
  }
  if (snapshotError) {
    throw new Error("Unable to load catalog snapshot details.");
  }

  return {
    impact: parseCatalogImpact(impactData),
    snapshot: parseCatalogSnapshotMeta(snapshotData),
  };
}

export async function unlistAllProductsAction(confirmed: boolean): Promise<CatalogResetResult> {
  if (!confirmed) {
    return { success: false, error: "Confirmation is required to unlist every product." };
  }
  const { supabase } = await requireAdmin();
  const { data, error } = await supabase.rpc("admin_unlist_all_products", { p_confirmed: true });
  if (error) {
    return { success: false, error: rpcError(error.message, "Products could not be unlisted. Nothing was changed.") };
  }
  revalidateCatalogSurfaces();
  const payload = (data ?? {}) as { updated?: number; impact?: unknown };
  return { success: true, updated: Number(payload.updated) || 0, impact: parseCatalogImpact(payload.impact) };
}

export async function clearAllPricesAction(confirmation: string): Promise<CatalogResetResult> {
  if (!confirmationMatches(confirmation, CLEAR_PRICES_PHRASE)) {
    return { success: false, error: "Type CLEAR PRICES to confirm." };
  }
  const { supabase } = await requireAdmin();
  const { data, error } = await supabase.rpc("admin_clear_all_prices", { p_confirmation: CLEAR_PRICES_PHRASE });
  if (error) {
    return { success: false, error: rpcError(error.message, "Prices could not be cleared. Nothing was changed.") };
  }
  revalidateCatalogSurfaces();
  const payload = (data ?? {}) as { updated?: number; impact?: unknown };
  return { success: true, updated: Number(payload.updated) || 0, impact: parseCatalogImpact(payload.impact) };
}

export async function freshCatalogResetAction(confirmation: string, confirmed: boolean): Promise<CatalogResetResult> {
  if (!confirmationMatches(confirmation, FRESH_START_PHRASE)) {
    return { success: false, error: "Type FRESH START to confirm." };
  }
  if (!confirmed) {
    return { success: false, error: "The Reset Catalog confirmation is required." };
  }
  const { supabase } = await requireAdmin();
  const { error } = await supabase.rpc("admin_fresh_catalog_reset", {
    p_confirmation: FRESH_START_PHRASE,
    p_confirmed: true,
  });
  if (error) {
    return { success: false, error: rpcError(error.message, "Catalog reset could not finish. Nothing was changed.") };
  }
  revalidateCatalogSurfaces();
  redirect("/admin/products?status=draft&success=catalog_reset");
}

export async function restoreLastCatalogSnapshotAction(confirmation: string): Promise<CatalogResetResult> {
  if (!confirmationMatches(confirmation, RESTORE_PHRASE)) {
    return { success: false, error: "Type RESTORE to confirm." };
  }
  const { supabase } = await requireAdmin();
  const { data, error } = await supabase.rpc("admin_restore_last_catalog_snapshot", { p_confirmation: RESTORE_PHRASE });
  if (error) {
    return { success: false, error: rpcError(error.message, "The snapshot could not be restored. Nothing was changed.") };
  }
  revalidateCatalogSurfaces();
  const payload = (data ?? {}) as { updated?: number; impact?: unknown };
  return { success: true, updated: Number(payload.updated) || 0, impact: parseCatalogImpact(payload.impact) };
}

export async function bulkSetPriceAction(productIds: string[], priceInput: string): Promise<CatalogResetResult> {
  const uniqueIds = [...new Set(productIds.filter(Boolean))];
  if (uniqueIds.length === 0) {
    return { success: false, error: "Select at least one product." };
  }
  const parsed = parsePriceInput(priceInput);
  if (!parsed.ok) return { success: false, error: parsed.error };
  if (parsed.value === null || parsed.value <= 0) {
    return { success: false, error: "Enter a valid price greater than zero." };
  }
  const { supabase } = await requireAdmin();
  const { data, error } = await supabase.rpc("admin_bulk_set_price", {
    p_product_ids: uniqueIds,
    p_price: parsed.value,
  });
  if (error) {
    return { success: false, error: rpcError(error.message, "Prices could not be saved. Nothing was changed.") };
  }
  revalidateCatalogSurfaces();
  return { success: true, updated: Number(data) || uniqueIds.length, impact: parseCatalogImpact(null) };
}

export async function bulkActivateEligibleAction(
  productIds: string[],
): Promise<{ success: true; activated: number; selected: number } | { success: false; error: string }> {
  const uniqueIds = [...new Set(productIds.filter(Boolean))];
  if (uniqueIds.length === 0) {
    return { success: false, error: "Select at least one product." };
  }
  const { supabase } = await requireAdmin();
  const { data, error } = await supabase.rpc("admin_bulk_activate_eligible", { p_product_ids: uniqueIds });
  if (error) {
    return { success: false, error: rpcError(error.message, "Eligible products could not be activated. Nothing was changed.") };
  }
  revalidateCatalogSurfaces();
  const payload = (data ?? {}) as { activated?: number; selected?: number };
  return {
    success: true,
    activated: Number(payload.activated) || 0,
    selected: Number(payload.selected) || uniqueIds.length,
  };
}
