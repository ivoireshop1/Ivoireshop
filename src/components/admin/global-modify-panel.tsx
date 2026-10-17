"use client";

import { useMemo, useState } from "react";
import { applyGlobalModify } from "@/src/lib/catalog/bulk-actions";
import { previewGlobalModify, type GlobalModifyDraft } from "@/src/lib/catalog/global-modify";
import type { AdminProductRowData } from "@/src/components/admin/admin-product-row";

export function GlobalModifyPanel({
  products,
  selectedIds,
  categories,
  onSaved,
}: {
  products: AdminProductRowData[];
  selectedIds: string[];
  categories: Array<{ id: string; name: string; parent_id?: string | null }>;
  onSaved: () => void;
}) {
  const [draft, setDraft] = useState<GlobalModifyDraft>({});
  const [previewOpen, setPreviewOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const roots = categories.filter((category) => !category.parent_id);
  const children = categories.filter((category) => category.parent_id && (!draft.category_id || category.parent_id === draft.category_id));
  const selectedProducts = products.filter((product) => selectedIds.includes(product.id));
  const preview = useMemo(
    () =>
      previewGlobalModify(
        selectedProducts.map((product) => ({
          id: product.id,
          name: product.name,
          category_id: product.categoryId ?? "",
          subcategory_id: product.subcategoryId,
          price: product.price,
          stock_quantity: product.stockQuantity,
          is_active: product.isActive,
        })),
        selectedIds,
        draft,
        categories,
      ),
    [categories, draft, selectedIds, selectedProducts],
  );

  async function save() {
    setBusy(true);
    setMessage(null);
    const result = await applyGlobalModify(selectedIds, draft);
    setBusy(false);
    if (result.errors.length) {
      setPreviewOpen(true);
      setMessage(`Saved ${result.saved}. ${result.errors.length} product${result.errors.length === 1 ? "" : "s"} need attention.`);
      return;
    }
    setMessage(`Saved ${result.saved} product${result.saved === 1 ? "" : "s"}.`);
    setDraft({});
    setPreviewOpen(false);
    onSaved();
  }

  if (!selectedIds.length) return null;

  return (
    <section className="rounded-2xl border border-[#173f35]/15 bg-[#f9f7f3] p-4">
      <h3 className="text-sm font-semibold text-[#173f35]">Global Modify</h3>
      <p className="mt-1 text-xs text-[#6b6b6b]">Edits stay in this preview until you click Save. Unchanged fields are left alone.</p>
      <div className="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-5">
        <label className="text-xs text-[#6b6b6b]">
          Category
          <select className="mt-1 min-h-11 w-full rounded-xl border border-[#173f35]/15 bg-white px-3" onChange={(event) => setDraft((current) => ({ ...current, category_id: event.target.value, subcategory_id: "" }))} value={draft.category_id ?? ""}>
            <option value="">Keep current</option>
            {roots.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}
          </select>
        </label>
        <label className="text-xs text-[#6b6b6b]">
          Subcategory
          <select className="mt-1 min-h-11 w-full rounded-xl border border-[#173f35]/15 bg-white px-3" onChange={(event) => setDraft((current) => ({ ...current, subcategory_id: event.target.value }))} value={draft.subcategory_id ?? ""}>
            <option value="">Keep current</option>
            <option value="__clear__">None</option>
            {children.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}
          </select>
        </label>
        <label className="text-xs text-[#6b6b6b]">
          Price
          <input className="mt-1 min-h-11 w-full rounded-xl border border-[#173f35]/15 bg-white px-3" onChange={(event) => setDraft((current) => ({ ...current, price: event.target.value }))} placeholder="Keep current" value={draft.price ?? ""} />
        </label>
        <label className="text-xs text-[#6b6b6b]">
          Stock
          <input className="mt-1 min-h-11 w-full rounded-xl border border-[#173f35]/15 bg-white px-3" onChange={(event) => setDraft((current) => ({ ...current, stock_quantity: event.target.value }))} placeholder="Keep current" value={draft.stock_quantity ?? ""} />
        </label>
        <label className="text-xs text-[#6b6b6b]">
          Status
          <select className="mt-1 min-h-11 w-full rounded-xl border border-[#173f35]/15 bg-white px-3" onChange={(event) => setDraft((current) => ({ ...current, is_active: event.target.value as GlobalModifyDraft["is_active"] }))} value={draft.is_active ?? ""}>
            <option value="">Keep current</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </select>
        </label>
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        <button className="min-h-11 rounded-xl border border-[#173f35]/20 px-4 text-sm font-semibold text-[#173f35]" onClick={() => setPreviewOpen((open) => !open)} type="button">
          {previewOpen ? "Hide preview" : "Preview changes"}
        </button>
        <button className="min-h-11 rounded-xl bg-[#173f35] px-4 text-sm font-semibold text-white disabled:opacity-60" disabled={busy} onClick={() => void save()} type="button">
          {busy ? "Saving..." : "Save"}
        </button>
      </div>
      {message ? <p className="mt-2 text-sm text-[#173f35]">{message}</p> : null}
      {previewOpen ? (
        <ul className="mt-3 max-h-56 space-y-2 overflow-auto text-sm">
          {preview.map((row) => (
            <li className={`rounded-xl px-3 py-2 ${row.error ? "bg-[#7f1d1d]/10 text-[#7f1d1d]" : "bg-white text-[#173f35]"}`} key={row.id}>
              <span className="font-medium">{row.name}</span>
              {row.error ? <span className="ml-2">{row.error}</span> : <span className="ml-2 text-[#6b6b6b]">{Object.keys(row.changes).join(", ") || "No fields selected"}</span>}
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}
