"use client";

import Image from "next/image";
import Link from "next/link";
import { useRef, useState, type ChangeEvent } from "react";
import { DeleteProductForm } from "@/src/components/admin/delete-product-form";
import { adminSetFeatured, adminSetProductStatus, adminUpdateProductPricing } from "@/src/lib/catalog/admin-actions";
import { formatStockInput, parsePriceInput, parseStockInput } from "@/src/lib/catalog/pricing-input";

export type AdminProductRowData = {
  id: string;
  name: string;
  slug: string;
  createdAt: string;
  categoryName: string;
  imageUrl: string | null;
  price: number | null;
  stockQuantity: number | null;
  isActive: boolean;
  isFeatured: boolean;
};

type SaveState = "idle" | "saving" | "saved" | "error";

function deriveStatus(isActive: boolean) {
  return isActive ? "active" : "hidden";
}

function SaveIndicator({ state, error }: { state: SaveState; error: string | null }) {
  if (state === "saving") return <p className="mt-1 text-xs text-[#6b6b6b]">Saving...</p>;
  if (state === "saved") return <p className="mt-1 text-xs text-[#173f35]">Saved</p>;
  if (state === "error") return <p className="mt-1 text-xs text-[#7f1d1d]">{error}</p>;
  return null;
}

function displayPrice(value: number | null) {
  return value === null ? "" : String(value);
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
  const [isActive, setIsActive] = useState(product.isActive);
  const [isFeatured, setIsFeatured] = useState(product.isFeatured);
  const [persistedPrice, setPersistedPrice] = useState(product.price);
  const [persistedStock, setPersistedStock] = useState(product.stockQuantity);
  const [priceInput, setPriceInput] = useState(displayPrice(product.price));
  const [stockInput, setStockInput] = useState(formatStockInput(product.stockQuantity));
  const [statusState, setStatusState] = useState<SaveState>("idle");
  const [statusError, setStatusError] = useState<string | null>(null);
  const [featuredState, setFeaturedState] = useState<SaveState>("idle");
  const [pricingState, setPricingState] = useState<SaveState>("idle");
  const [pricingError, setPricingError] = useState<string | null>(null);
  const saveLock = useRef(false);

  const status = deriveStatus(isActive);
  const needsPricing = persistedPrice === null;
  const needsStock = persistedStock === null;
  const inventoryLabel = needsStock
    ? "Needs stock"
    : Number(persistedStock) === 0
      ? "Out of stock"
      : Number(persistedStock) <= 5
        ? "Low stock"
        : "In stock";
  const isDirty =
    priceInput !== displayPrice(persistedPrice) || stockInput !== formatStockInput(persistedStock);

  async function handleStatusChange(event: ChangeEvent<HTMLSelectElement>) {
    const nextStatus = event.target.value as "active" | "hidden";
    const previousIsActive = isActive;
    setStatusState("saving");
    setStatusError(null);
    setIsActive(nextStatus === "active");
    const result = await adminSetProductStatus(product.id, nextStatus);
    if (!result.success) {
      setIsActive(previousIsActive);
      setStatusState("error");
      setStatusError(result.error);
      return;
    }
    setIsActive(result.data.is_active);
    setStatusState("saved");
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

  async function savePricing() {
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

    saveLock.current = true;
    setPricingState("saving");
    setPricingError(null);
    const result = await adminUpdateProductPricing(product.id, priceInput, stockInput);
    saveLock.current = false;
    if (!result.success) {
      setPricingState("error");
      setPricingError(result.error);
      return;
    }
    setPersistedPrice(result.data.price);
    setPersistedStock(result.data.stock_quantity);
    setPriceInput(displayPrice(result.data.price));
    setStockInput(formatStockInput(result.data.stock_quantity));
    setIsActive(result.data.is_active);
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
          <p className="mt-1 text-xs text-[#6b6b6b]">Updated {new Date(product.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</p>
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
          onChange={(event) => {
            setPriceInput(event.target.value);
            setPricingState("idle");
            setPricingError(null);
          }}
          placeholder="0.00"
          value={priceInput}
        />
        <p className="mt-1 text-xs text-[#6b6b6b]">{needsPricing ? "Needs pricing" : `Saved $${Number(persistedPrice).toFixed(2)}`}</p>
      </label>

      <label className="mt-4 block lg:mt-0">
        <span className="text-[11px] font-medium uppercase tracking-[0.18em] text-[#6b6b6b]">Inventory</span>
        <input
          aria-label={`Stock quantity for ${product.name}`}
          className="mt-1 min-h-11 w-full rounded-lg border border-[#173f35]/15 bg-white px-3 py-2 text-sm text-[#173f35]"
          inputMode="numeric"
          onChange={(event) => {
            setStockInput(event.target.value);
            setPricingState("idle");
            setPricingError(null);
          }}
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
          onChange={(event) => void handleStatusChange(event)}
          value={status}
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
          disabled={pricingState === "saving" || !isDirty}
          onClick={() => void savePricing()}
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
