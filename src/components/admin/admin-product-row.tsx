"use client";

import Image from "next/image";
import Link from "next/link";
import { useRef, useState, type ChangeEvent } from "react";
import { DeleteProductForm } from "@/src/components/admin/delete-product-form";
import { adminSetFeatured, adminUpdateProductPricing } from "@/src/lib/catalog/admin-actions";
import {
  draftsReadyForActivation,
  formatPriceDisplay,
  formatStockInput,
  inventoryStatusFromDraft,
  parsePriceInput,
  parseStockInput,
  priceStatusFromDraft,
} from "@/src/lib/catalog/pricing-input";

export type AdminProductRowData = {
  id: string;
  name: string;
  slug: string;
  createdAt: string;
  categoryName: string;
  imageUrl: string | null;
  price: number | string | null;
  stockQuantity: number | string | null;
  isActive: boolean;
  isFeatured: boolean;
};

function toNullableNumber(value: number | string | null | undefined) {
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

type SaveState = "idle" | "saving" | "saved" | "error";
type RowStatus = "active" | "hidden";

function deriveStatus(isActive: boolean): RowStatus {
  return isActive ? "active" : "hidden";
}

function SaveIndicator({ state, error }: { state: SaveState; error: string | null }) {
  if (state === "saving") return <p className="mt-1 text-xs text-[#6b6b6b]">Saving...</p>;
  if (state === "saved") return <p className="mt-1 text-xs text-[#173f35]">Saved</p>;
  if (state === "error") return <p className="mt-1 text-xs text-[#7f1d1d]">{error}</p>;
  return null;
}

export function AdminProductRow({
  product,
  deleteAction,
  duplicateAction,
}: {
  product: AdminProductRowData;
  deleteAction: (formData: FormData) => void | Promise<void>;
  duplicateAction: (formData: FormData) => void | Promise<void>;
}) {
  const [isFeatured, setIsFeatured] = useState(product.isFeatured);
  const [persistedPrice, setPersistedPrice] = useState(toNullableNumber(product.price));
  const [persistedStock, setPersistedStock] = useState(toNullableNumber(product.stockQuantity));
  const [persistedStatus, setPersistedStatus] = useState<RowStatus>(deriveStatus(product.isActive));
  const [draftStatus, setDraftStatus] = useState<RowStatus>(deriveStatus(product.isActive));
  const [priceInput, setPriceInput] = useState(formatPriceDisplay(toNullableNumber(product.price)));
  const [stockInput, setStockInput] = useState(formatStockInput(toNullableNumber(product.stockQuantity)));
  const [statusState, setStatusState] = useState<SaveState>("idle");
  const [statusError, setStatusError] = useState<string | null>(null);
  const [featuredState, setFeaturedState] = useState<SaveState>("idle");
  const [pricingState, setPricingState] = useState<SaveState>("idle");
  const [pricingError, setPricingError] = useState<string | null>(null);
  const saveLock = useRef(false);

  const parsedPrice = parsePriceInput(priceInput);
  const parsedStock = parseStockInput(stockInput);
  const draftsValid = parsedPrice.ok && parsedStock.ok;
  const priceLabel = priceStatusFromDraft(priceInput);
  const inventoryLabel = inventoryStatusFromDraft(stockInput);
  const savedPriceLabel = persistedPrice === null ? null : `Saved $${persistedPrice.toFixed(2)}`;
  const isDirty =
    priceInput !== formatPriceDisplay(persistedPrice) ||
    stockInput !== formatStockInput(persistedStock) ||
    draftStatus !== persistedStatus;
  const saveEnabled = draftsValid && isDirty && pricingState !== "saving";

  function applyDraftInputs(nextPrice: string, nextStock: string, nextStatus: RowStatus) {
    setPriceInput(nextPrice);
    setStockInput(nextStock);
    setDraftStatus(nextStatus);
    setPricingState("idle");
    setPricingError(null);
    if (nextStatus === "active") {
      const ready = draftsReadyForActivation(nextPrice, nextStock);
      if (!ready.ok) {
        setStatusState("error");
        setStatusError(ready.error);
        return;
      }
    }
    setStatusState("idle");
    setStatusError(null);
  }

  function handleStatusChange(event: ChangeEvent<HTMLSelectElement>) {
    applyDraftInputs(priceInput, stockInput, event.target.value as RowStatus);
  }

  async function handleFeaturedToggle() {
    const previous = isFeatured;
    const next = !isFeatured;
    setIsFeatured(next);
    setFeaturedState("saving");
    const result = await adminSetFeatured(product.id, next);
    if (!result.success) {
      setIsFeatured(previous);
      setFeaturedState("error");
      return;
    }
    setFeaturedState("saved");
  }

  async function saveRow() {
    if (saveLock.current || pricingState === "saving") return;
    const price = parsePriceInput(priceInput);
    const stock = parseStockInput(stockInput);
    if (!price.ok) {
      setPricingState("error");
      setPricingError(price.error);
      return;
    }
    if (!stock.ok) {
      setPricingState("error");
      setPricingError(stock.error);
      return;
    }
    if (draftStatus === "active") {
      const ready = draftsReadyForActivation(priceInput, stockInput);
      if (!ready.ok) {
        setStatusState("error");
        setStatusError(ready.error);
        setPricingState("error");
        setPricingError(ready.error);
        return;
      }
    }

    saveLock.current = true;
    setPricingState("saving");
    setPricingError(null);
    const result = await adminUpdateProductPricing(product.id, priceInput, stockInput, draftStatus);
    saveLock.current = false;
    if (!result.success) {
      setPricingState("error");
      setPricingError(result.error);
      return;
    }
    setPersistedPrice(result.data.price);
    setPersistedStock(result.data.stock_quantity);
    setPersistedStatus(deriveStatus(result.data.is_active));
    setDraftStatus(deriveStatus(result.data.is_active));
    setPriceInput(formatPriceDisplay(result.data.price));
    setStockInput(formatStockInput(result.data.stock_quantity));
    setStatusError(null);
    setStatusState("idle");
    setPricingState("saved");
  }

  return (
    <article className="rounded-2xl border border-[#173f35]/10 bg-[#f9f7f3] p-4 lg:grid lg:grid-cols-[1.6fr_0.8fr_0.9fr_0.9fr_0.9fr_0.8fr_0.9fr] lg:items-start lg:gap-3 lg:p-3">
      <div className="flex items-center gap-3">
        <div className="h-16 w-16 shrink-0 overflow-hidden rounded-xl border border-[#173f35]/10 bg-white lg:h-14 lg:w-14">
          {product.imageUrl ? (
            <Image alt={product.name} className="h-full w-full object-cover" height={64} src={product.imageUrl} unoptimized width={64} />
          ) : (
            <span className="flex h-full items-center justify-center text-xs text-[#6b6b6b]">No image</span>
          )}
        </div>
        <div className="min-w-0">
          <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-[#6b6b6b] lg:hidden">Product</p>
          <Link className="block break-words font-medium text-[#173f35] hover:underline" href={`/admin/products/${product.id}`}>
            {product.name}
          </Link>
          <p className="mt-1 text-xs text-[#6b6b6b]">Updated {product.createdAt.slice(0, 10)}</p>
        </div>
      </div>

      <div className="mt-4 text-sm text-[#173f35] lg:mt-0">
        <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-[#6b6b6b] lg:hidden">Category</p>
        <p className="break-words">{product.categoryName}</p>
      </div>

      <label className="mt-4 block lg:mt-0">
        <span className="text-[11px] font-medium uppercase tracking-[0.18em] text-[#6b6b6b]">Price</span>
        <input
          aria-label={`Price for ${product.name}`}
          className="mt-1 min-h-11 w-full rounded-lg border border-[#173f35]/15 bg-white px-3 py-2 text-sm text-[#173f35]"
          inputMode="decimal"
          onBlur={() => {
            if (parsedPrice.ok && parsedPrice.value !== null) setPriceInput(formatPriceDisplay(parsedPrice.value));
          }}
          onChange={(event) => applyDraftInputs(event.target.value, stockInput, draftStatus)}
          placeholder="0.00"
          value={priceInput}
        />
        <p className="mt-1 text-xs text-[#6b6b6b]">{priceLabel ?? (isDirty ? "" : savedPriceLabel)}</p>
      </label>

      <label className="mt-4 block lg:mt-0">
        <span className="text-[11px] font-medium uppercase tracking-[0.18em] text-[#6b6b6b]">Inventory</span>
        <input
          aria-label={`Stock quantity for ${product.name}`}
          className="mt-1 min-h-11 w-full rounded-lg border border-[#173f35]/15 bg-white px-3 py-2 text-sm text-[#173f35]"
          inputMode="numeric"
          onChange={(event) => applyDraftInputs(priceInput, event.target.value, draftStatus)}
          placeholder="0"
          value={stockInput}
        />
        <p className="mt-1 text-xs text-[#6b6b6b]">{inventoryLabel}</p>
      </label>

      <div className="mt-4 lg:mt-0">
        <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-[#6b6b6b]">Status</p>
        <select
          aria-label={`Status for ${product.name}`}
          className="mt-1 min-h-11 w-full rounded-lg border border-[#173f35]/15 bg-white px-3 py-2 text-sm text-[#173f35]"
          onChange={handleStatusChange}
          value={draftStatus}
        >
          <option value="active">Active</option>
          <option value="hidden">Draft</option>
        </select>
        <SaveIndicator error={statusError} state={statusState} />
      </div>

      <div className="mt-4 lg:mt-0">
        <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-[#6b6b6b]">Featured</p>
        <button
          className={`mt-1 min-h-11 w-full rounded-lg px-3 py-2 text-sm font-medium ${isFeatured ? "bg-[#b8964c]/15 text-[#7c5d1a]" : "bg-[#173f35]/5 text-[#173f35]"}`}
          onClick={() => void handleFeaturedToggle()}
          type="button"
        >
          {isFeatured ? "Featured" : "Not Featured"}
        </button>
        <SaveIndicator error={null} state={featuredState} />
      </div>

      <div className="mt-4 flex flex-col gap-3 lg:mt-0">
        <button
          className="min-h-11 rounded-lg bg-[#173f35] px-3 py-2 text-sm font-medium text-white disabled:opacity-60"
          disabled={!saveEnabled}
          onClick={() => void saveRow()}
          type="button"
        >
          {pricingState === "saving" ? "Saving..." : "Save"}
        </button>
        <SaveIndicator error={pricingError} state={pricingState} />
        <div className="flex flex-wrap items-center gap-3">
          <Link className="min-h-11 text-sm text-[#173f35] underline-offset-2 hover:underline" href={`/admin/products/${product.id}`}>
            Edit
          </Link>
          <Link className="min-h-11 text-sm text-[#173f35] underline-offset-2 hover:underline" href={`/product/${product.slug}`} target="_blank">
            View
          </Link>
          <form action={duplicateAction}>
            <input name="id" type="hidden" value={product.id} />
            <button className="min-h-11 text-sm text-[#173f35] underline-offset-2 hover:underline" type="submit">
              Duplicate
            </button>
          </form>
          <DeleteProductForm action={deleteAction} id={product.id} />
        </div>
      </div>
    </article>
  );
}
