import { parsePriceInput } from "./pricing-input.ts";

export type GlobalModifyField = "category_id" | "subcategory_id" | "price" | "stock_quantity" | "is_active";

export type GlobalModifyDraft = {
  category_id?: string;
  subcategory_id?: string | null;
  price?: string;
  stock_quantity?: string;
  is_active?: "active" | "inactive" | "";
};

export type GlobalModifyProduct = {
  id: string;
  name: string;
  category_id: string;
  subcategory_id?: string | null;
  price: number | string | null;
  stock_quantity: number | string | null;
  is_active: boolean;
};

export type GlobalModifyPreviewRow = {
  id: string;
  name: string;
  changes: Partial<Record<GlobalModifyField, string | null>>;
  error?: string;
};

export function previewGlobalModify(
  products: GlobalModifyProduct[],
  selectedIds: string[],
  draft: GlobalModifyDraft,
  categories: Array<{ id: string; parent_id?: string | null }>,
): GlobalModifyPreviewRow[] {
  const selected = new Set(selectedIds);
  const rows = products.filter((product) => selected.has(product.id));
  return rows.map((product) => {
    const changes: GlobalModifyPreviewRow["changes"] = {};
    const error = validateGlobalModifyRow(product, draft, categories);
    if (draft.category_id) changes.category_id = draft.category_id;
    if (draft.subcategory_id !== undefined && draft.subcategory_id !== "") {
      changes.subcategory_id = draft.subcategory_id === "__clear__" ? "none" : draft.subcategory_id;
    }
    if (draft.price?.trim()) changes.price = draft.price.trim();
    if (draft.stock_quantity?.trim()) changes.stock_quantity = draft.stock_quantity.trim();
    if (draft.is_active === "active" || draft.is_active === "inactive") changes.is_active = draft.is_active;
    return { id: product.id, name: product.name, changes, error };
  });
}

export function validateGlobalModifyRow(
  product: GlobalModifyProduct,
  draft: GlobalModifyDraft,
  categories: Array<{ id: string; parent_id?: string | null }>,
): string | undefined {
  const categoryId = draft.category_id || product.category_id;
  if (draft.category_id && !categories.some((category) => category.id === draft.category_id && !category.parent_id)) {
    return "Choose a top-level category.";
  }
  if (draft.subcategory_id && draft.subcategory_id !== "__clear__") {
    const child = categories.find((category) => category.id === draft.subcategory_id);
    if (!child || (draft.category_id && child.parent_id !== draft.category_id) || child.parent_id !== categoryId) return "Subcategory must belong to the selected category.";
  }
  if (draft.price?.trim()) {
    const parsed = parsePriceInput(draft.price);
    if (!parsed.ok || parsed.value == null) return "Enter a valid price.";
  }
  if (draft.stock_quantity?.trim()) {
    const parsed = Number(draft.stock_quantity);
    if (!Number.isInteger(parsed) || parsed < 0) return "Enter a whole-number stock quantity.";
  }
  if (draft.is_active && draft.is_active !== "active" && draft.is_active !== "inactive") {
    return "Status must be Active or Inactive.";
  }
  if (!Object.values(draft).some((value) => value !== undefined && value !== "" && value !== null)) {
    return "Choose at least one field to change.";
  }
  return undefined;
}

export function globalModifyPatch(draft: GlobalModifyDraft) {
  const patch: Record<string, unknown> = {};
  if (draft.category_id) patch.category_id = draft.category_id;
  if (draft.subcategory_id === "__clear__") patch.subcategory_id = null;
  else if (draft.subcategory_id) patch.subcategory_id = draft.subcategory_id;
  if (draft.price?.trim()) {
    const parsed = parsePriceInput(draft.price);
    if (parsed.ok) patch.price = parsed.value;
  }
  if (draft.stock_quantity?.trim()) patch.stock_quantity = Number(draft.stock_quantity);
  if (draft.is_active === "active") patch.is_active = true;
  if (draft.is_active === "inactive") patch.is_active = false;
  return patch;
}
