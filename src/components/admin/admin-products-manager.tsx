"use client";

import { useMemo, useState } from "react";
import { AdminProductRow, type AdminProductRowData } from "@/src/components/admin/admin-product-row";
import { bulkMoveCanonicalCategory } from "@/src/lib/catalog/bulk-actions";
import {
  bulkMoveConfirmation,
  clearSelection,
  isVisibleSelectionComplete,
  selectAllVisible,
} from "@/src/lib/catalog/bulk-selection";
import { CANONICAL_CATEGORIES } from "@/src/lib/catalog/canonical-categories";

export function AdminProductsManager({
  products,
  deleteAction,
  duplicateAction,
}: {
  products: AdminProductRowData[];
  deleteAction: (formData: FormData) => void | Promise<void>;
  duplicateAction: (formData: FormData) => void | Promise<void>;
}) {
  const [selected, setSelected] = useState<string[]>([]);
  const [targetSlug, setTargetSlug] = useState<(typeof CANONICAL_CATEGORIES)[number]["slug"]>("ivoire-market");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const visibleIds = useMemo(() => products.map((product) => product.id), [products]);
  const allVisibleSelected = isVisibleSelectionComplete(selected, visibleIds);
  const targetName = CANONICAL_CATEGORIES.find((category) => category.slug === targetSlug)?.name ?? "Ivoire Market";

  function handleSelectedChange(id: string, next: boolean) {
    setSelected((current) => {
      const has = current.includes(id);
      if (next && !has) return [...current, id];
      if (!next && has) return current.filter((item) => item !== id);
      return current;
    });
  }

  async function moveSelected() {
    if (!selected.length || busy) return;
    if (!window.confirm(bulkMoveConfirmation(selected.length, targetName))) return;
    setBusy(true);
    setError(null);
    setMessage(null);
    const result = await bulkMoveCanonicalCategory(selected, targetSlug);
    setBusy(false);
    if (!result.success) {
      setError(result.error);
      return;
    }
    setMessage(`${result.moved} products moved to ${result.categoryName}.`);
    setSelected(clearSelection());
  }

  return (
    <div className="space-y-4">
      {error ? <p className="rounded-2xl border border-[#7f1d1d]/20 bg-[#7f1d1d]/5 px-4 py-3 text-sm text-[#7f1d1d]">{error}</p> : null}
      {message ? <p className="rounded-2xl border border-[#173f35]/15 bg-[#173f35]/5 px-4 py-3 text-sm text-[#173f35]">{message}</p> : null}

      {selected.length > 0 ? (
        <div className="sticky bottom-3 z-20 rounded-2xl border border-[#173f35]/15 bg-white p-4 shadow-[0_12px_32px_rgba(23,63,53,0.12)]">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
            <p className="text-sm font-semibold text-[#173f35]">{selected.length} products selected</p>
            <div className="grid gap-3 sm:grid-cols-[1fr_auto] lg:min-w-[28rem]">
              <label className="block text-sm text-[#6b6b6b]">
                <span className="mb-1 block text-[11px] font-medium uppercase tracking-[0.18em]">Move to</span>
                <select
                  className="min-h-11 w-full rounded-xl border border-[#173f35]/15 bg-[#f9f7f3] px-3 py-2 text-[#173f35]"
                  onChange={(event) => setTargetSlug(event.target.value as typeof targetSlug)}
                  value={targetSlug}
                >
                  {CANONICAL_CATEGORIES.map((category) => (
                    <option key={category.slug} value={category.slug}>{category.name}</option>
                  ))}
                </select>
              </label>
              <button
                className="min-h-11 rounded-xl bg-[#173f35] px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
                disabled={busy}
                onClick={() => void moveSelected()}
                type="button"
              >
                {busy ? "Moving..." : "Move products"}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      <div className="flex flex-wrap items-center gap-3">
        <label className="inline-flex min-h-11 items-center gap-2 text-sm text-[#173f35]">
          <input
            checked={allVisibleSelected}
            className="h-5 w-5 accent-[#173f35]"
            onChange={(event) => setSelected(event.target.checked ? selectAllVisible(visibleIds) : clearSelection())}
            type="checkbox"
          />
          Select all visible
        </label>
        <button className="min-h-11 text-sm font-semibold text-[#173f35] underline underline-offset-4" onClick={() => setSelected(clearSelection())} type="button">
          Clear selection
        </button>
        <p className="text-sm text-[#6b6b6b]">{selected.length} products selected</p>
      </div>

      <div className="hidden items-center gap-3 border-b border-[#173f35]/10 px-3 pb-3 text-[11px] font-medium uppercase tracking-[0.18em] text-[#6b6b6b] lg:grid lg:grid-cols-[2.25rem_1.6fr_0.8fr_0.9fr_0.9fr_0.9fr_0.8fr_0.9fr]">
        <span className="sr-only">Select</span>
        <span>Product</span>
        <span>Category</span>
        <span>Price</span>
        <span>Inventory</span>
        <span>Status</span>
        <span>Featured</span>
        <span>Actions</span>
      </div>

      {products.length === 0 ? (
        <div className="px-3 py-10 text-center">
          <p className="text-xl font-semibold text-[#173f35]">No products found</p>
          <p className="mt-2 text-sm text-[#6b6b6b]">Try adjusting your search or filters.</p>
        </div>
      ) : (
        <div className="space-y-4 pt-3">
          {products.map((product) => (
            <AdminProductRow
              deleteAction={deleteAction}
              duplicateAction={duplicateAction}
              key={product.id}
              onSelectedChange={handleSelectedChange}
              product={product}
              selected={selected.includes(product.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
