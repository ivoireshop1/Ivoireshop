"use client";

import { useRouter } from "next/navigation";
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
import { bulkActivateEligibleAction, bulkSetPriceAction } from "@/src/lib/catalog/catalog-reset-actions";
import {
  bulkActivateConfirmation,
  bulkPriceConfirmation,
  isBulkActivateEligible,
} from "@/src/lib/catalog/catalog-reset";
import { formatPriceDisplay, parsePriceInput } from "@/src/lib/catalog/pricing-input";

export function AdminProductsManager({
  products,
  deleteAction,
  duplicateAction,
}: {
  products: AdminProductRowData[];
  deleteAction: (formData: FormData) => void | Promise<void>;
  duplicateAction: (formData: FormData) => void | Promise<void>;
}) {
  const router = useRouter();
  const [selected, setSelected] = useState<string[]>([]);
  const [targetSlug, setTargetSlug] = useState<"" | (typeof CANONICAL_CATEGORIES)[number]["slug"]>("");
  const [bulkPrice, setBulkPrice] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const visibleIds = useMemo(() => products.map((product) => product.id), [products]);
  const selectedProducts = useMemo(
    () => products.filter((product) => selected.includes(product.id)),
    [products, selected],
  );
  const eligibleCount = selectedProducts.filter((product) =>
    isBulkActivateEligible({
      name: product.name,
      hasCategory: product.hasCategory,
      hasImage: product.hasImage,
      price: product.price,
      stockQuantity: product.stockQuantity,
      trackInventory: product.trackInventory !== false,
    }),
  ).length;
  const allVisibleSelected = isVisibleSelectionComplete(selected, visibleIds);
  const targetName = CANONICAL_CATEGORIES.find((category) => category.slug === targetSlug)?.name ?? "";
  const parsedBulkPrice = parsePriceInput(bulkPrice);

  function handleSelectedChange(id: string, next: boolean) {
    setSelected((current) => {
      const has = current.includes(id);
      if (next && !has) return [...current, id];
      if (!next && has) return current.filter((item) => item !== id);
      return current;
    });
  }

  async function moveSelected() {
    if (!selected.length || busy || !targetSlug) return;
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
    router.refresh();
  }

  async function setSelectedPrice() {
    if (!selected.length || busy) return;
    if (!parsedBulkPrice.ok || parsedBulkPrice.value === null || parsedBulkPrice.value <= 0) {
      setError("Enter a valid price greater than zero.");
      return;
    }
    const priceLabel = `$${formatPriceDisplay(parsedBulkPrice.value)}`;
    if (!window.confirm(bulkPriceConfirmation(selected.length, priceLabel))) return;
    setBusy(true);
    setError(null);
    setMessage(null);
    const result = await bulkSetPriceAction(selected, bulkPrice);
    setBusy(false);
    if (!result.success) {
      setError(result.error);
      return;
    }
    setMessage(`Price ${priceLabel} saved on ${result.updated} selected products.`);
    setBulkPrice("");
    setSelected(clearSelection());
    router.refresh();
  }

  async function activateEligible() {
    if (!selected.length || busy || eligibleCount === 0) return;
    if (!window.confirm(bulkActivateConfirmation(eligibleCount))) return;
    setBusy(true);
    setError(null);
    setMessage(null);
    const result = await bulkActivateEligibleAction(selected);
    setBusy(false);
    if (!result.success) {
      setError(result.error);
      return;
    }
    setMessage(`${result.activated} eligible products activated of ${result.selected} selected.`);
    setSelected(clearSelection());
    router.refresh();
  }

  return (
    <div className="space-y-4">
      {error ? <p className="rounded-2xl border border-[#7f1d1d]/20 bg-[#7f1d1d]/5 px-4 py-3 text-sm text-[#7f1d1d]">{error}</p> : null}
      {message ? <p className="rounded-2xl border border-[#173f35]/15 bg-[#173f35]/5 px-4 py-3 text-sm text-[#173f35]">{message}</p> : null}

      {selected.length > 0 ? (
        <div className="sticky bottom-3 z-20 rounded-2xl border border-[#173f35]/15 bg-white p-4 shadow-[0_12px_32px_rgba(23,63,53,0.12)]">
          <div className="flex flex-col gap-3">
            <p className="text-sm font-semibold text-[#173f35]">{selected.length} products selected</p>
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-[1fr_auto_1fr_auto_auto]">
              <label className="block text-sm text-[#6b6b6b]">
                <span className="mb-1 block text-[11px] font-medium uppercase tracking-[0.18em]">Move to</span>
                <select
                  className="min-h-11 w-full rounded-xl border border-[#173f35]/15 bg-[#f9f7f3] px-3 py-2 text-[#173f35]"
                  onChange={(event) => setTargetSlug(event.target.value as typeof targetSlug)}
                  value={targetSlug}
                >
                  <option value="">Choose category</option>
                  {CANONICAL_CATEGORIES.map((category) => (
                    <option key={category.slug} value={category.slug}>{category.name}</option>
                  ))}
                </select>
              </label>
              <button
                className="min-h-11 rounded-xl bg-[#173f35] px-4 py-2 text-sm font-semibold text-white disabled:opacity-60 md:self-end"
                disabled={busy || !targetSlug}
                onClick={() => void moveSelected()}
                type="button"
              >
                {busy ? "Working..." : "Move products"}
              </button>
              <label className="block text-sm text-[#6b6b6b]">
                <span className="mb-1 block text-[11px] font-medium uppercase tracking-[0.18em]">Bulk set price</span>
                <input
                  className="min-h-11 w-full rounded-xl border border-[#173f35]/15 bg-[#f9f7f3] px-3 py-2 text-[#173f35]"
                  inputMode="decimal"
                  onChange={(event) => setBulkPrice(event.target.value)}
                  placeholder="Enter price"
                  value={bulkPrice}
                />
              </label>
              <button
                className="min-h-11 rounded-xl border border-[#173f35]/20 px-4 py-2 text-sm font-semibold text-[#173f35] disabled:opacity-60 md:self-end"
                disabled={busy || !parsedBulkPrice.ok || parsedBulkPrice.value === null || parsedBulkPrice.value <= 0}
                onClick={() => void setSelectedPrice()}
                type="button"
              >
                Set price
              </button>
              <button
                className="min-h-11 rounded-xl border border-[#173f35]/20 px-4 py-2 text-sm font-semibold text-[#173f35] disabled:opacity-60 md:self-end"
                disabled={busy || eligibleCount === 0}
                onClick={() => void activateEligible()}
                type="button"
              >
                Activate eligible ({eligibleCount})
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
