"use client";

import Image from "next/image";
import Link from "next/link";
import { useState, useTransition, type ChangeEvent, type KeyboardEvent } from "react";
import { DeleteProductForm } from "@/src/components/admin/delete-product-form";
import { adminSetFeatured, adminSetProductStatus, adminUpdateProductPricing } from "@/src/lib/catalog/admin-actions";

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

function deriveStatus(isActive: boolean, stockQuantity: number | null) {
  if (!isActive) return "hidden";
  if (Number(stockQuantity) === 0) return "sold_out";
  return "active";
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
  const [isActive, setIsActive] = useState(product.isActive);
  const [stockQuantity, setStockQuantity] = useState(product.stockQuantity);
  const [price, setPrice] = useState(product.price);
  const [isFeatured, setIsFeatured] = useState(product.isFeatured);

  const [priceInput, setPriceInput] = useState(product.price === null ? "" : String(product.price));
  const [stockInput, setStockInput] = useState(product.stockQuantity === null ? "" : String(product.stockQuantity));

  const [statusState, setStatusState] = useState<SaveState>("idle");
  const [statusError, setStatusError] = useState<string | null>(null);
  const [featuredState, setFeaturedState] = useState<SaveState>("idle");
  const [pricingState, setPricingState] = useState<SaveState>("idle");
  const [pricingError, setPricingError] = useState<string | null>(null);

  const [, startTransition] = useTransition();

  const status = deriveStatus(isActive, stockQuantity);
  const needsPricing = price === null;
  const needsStock = stockQuantity === null;
  const inventoryLabel = needsStock ? "Needs stock" : Number(stockQuantity) === 0 ? "Out of stock" : Number(stockQuantity) <= 5 ? "Low stock" : "In stock";

  function handleStatusChange(event: ChangeEvent<HTMLSelectElement>) {
    const nextStatus = event.target.value as "active" | "sold_out" | "hidden";
    const previousIsActive = isActive;
    const previousStock = stockQuantity;

    setStatusState("saving");
    setStatusError(null);
    setIsActive(nextStatus !== "hidden");
    if (nextStatus === "sold_out") setStockQuantity(0);

    startTransition(async () => {
      const result = await adminSetProductStatus(product.id, nextStatus);
      if (!result.success) {
        setIsActive(previousIsActive);
        setStockQuantity(previousStock);
        setStatusState("error");
        setStatusError(result.error);
        return;
      }
      setIsActive(result.data.is_active);
      setStockQuantity(result.data.stock_quantity);
      setStatusState("saved");
      setTimeout(() => setStatusState("idle"), 1500);
    });
  }

  function handleFeaturedToggle() {
    const previous = isFeatured;
    const next = !isFeatured;
    setIsFeatured(next);
    setFeaturedState("saving");

    startTransition(async () => {
      const result = await adminSetFeatured(product.id, next);
      if (!result.success) {
        setIsFeatured(previous);
        setFeaturedState("error");
        return;
      }
      setFeaturedState("saved");
      setTimeout(() => setFeaturedState("idle"), 1500);
    });
  }

  function commitPricing() {
    if (priceInput === (price === null ? "" : String(price)) && stockInput === (stockQuantity === null ? "" : String(stockQuantity))) {
      return;
    }

    const previousPrice = price;
    const previousStock = stockQuantity;
    const previousIsActive = isActive;

    setPricingState("saving");
    setPricingError(null);

    startTransition(async () => {
      const result = await adminUpdateProductPricing(product.id, priceInput, stockInput);
      if (!result.success) {
        setPricingState("error");
        setPricingError(result.error);
        setPriceInput(previousPrice === null ? "" : String(previousPrice));
        setStockInput(previousStock === null ? "" : String(previousStock));
        return;
      }
      setPrice(result.data.price);
      setStockQuantity(result.data.stock_quantity);
      setIsActive(result.data.is_active);
      if (result.data.is_active !== previousIsActive) {
        setStatusState("saved");
      }
      setPricingState("saved");
      setTimeout(() => setPricingState("idle"), 1500);
    });
  }

  function handlePricingKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Enter") {
      event.currentTarget.blur();
    }
  }

  return (
    <article className="rounded-2xl border border-[#173f35]/10 bg-[#f9f7f3] p-3 md:grid md:grid-cols-[1.6fr_0.8fr_0.7fr_0.8fr_0.9fr_0.7fr_0.8fr] md:items-center md:gap-3">
      <div className="flex items-center gap-3">
        <div className="h-14 w-14 overflow-hidden rounded-xl border border-[#173f35]/10 bg-white">
          {product.imageUrl ? (
            <Image alt={product.name} className="h-full w-full object-cover" height={56} src={product.imageUrl} unoptimized width={56} />
          ) : (
            <span className="flex h-full items-center justify-center text-xs text-[#6b6b6b]">No image</span>
          )}
        </div>
        <div className="min-w-0">
          <Link className="block truncate font-medium text-[#173f35] hover:underline" href={`/admin/products/${product.id}`}>
            {product.name}
          </Link>
          <p className="mt-1 text-xs text-[#6b6b6b]">Updated {new Date(product.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</p>
        </div>
      </div>

      <div className="mt-3 text-sm text-[#6b6b6b] md:mt-0">{product.categoryName}</div>

      <div className="mt-3 md:mt-0">
        <input
          aria-label={`Price for ${product.name}`}
          className="w-full rounded-lg border border-[#173f35]/15 bg-white px-2 py-1.5 text-sm text-[#173f35]"
          inputMode="decimal"
          onBlur={commitPricing}
          onChange={(event) => setPriceInput(event.target.value)}
          onKeyDown={handlePricingKeyDown}
          placeholder="Needs pricing"
          value={priceInput}
        />
      </div>

      <div className="mt-3 md:mt-0">
        <input
          aria-label={`Stock quantity for ${product.name}`}
          className="w-full rounded-lg border border-[#173f35]/15 bg-white px-2 py-1.5 text-sm text-[#173f35]"
          inputMode="numeric"
          onBlur={commitPricing}
          onChange={(event) => setStockInput(event.target.value)}
          onKeyDown={handlePricingKeyDown}
          placeholder="Needs stock"
          value={stockInput}
        />
        <p className="mt-1 text-xs text-[#6b6b6b]">{needsPricing ? "Needs pricing" : inventoryLabel}</p>
        <SaveIndicator error={pricingError} state={pricingState} />
      </div>

      <div className="mt-4 md:mt-0">
        <select
          className="w-full rounded-lg border border-[#173f35]/15 bg-white px-2 py-1.5 text-sm text-[#173f35]"
          onChange={handleStatusChange}
          value={status}
        >
          <option value="active">Active</option>
          <option value="sold_out">Sold Out</option>
          <option value="hidden">Hidden</option>
        </select>
        <SaveIndicator error={statusError} state={statusState} />
      </div>

      <div className="mt-4 md:mt-0">
        <button
          className={`w-full rounded-lg px-2 py-1.5 text-xs font-medium ${isFeatured ? "bg-[#b8964c]/15 text-[#7c5d1a]" : "bg-[#173f35]/5 text-[#173f35]"}`}
          onClick={handleFeaturedToggle}
          type="button"
        >
          {isFeatured ? "Featured" : "Not Featured"}
        </button>
        <SaveIndicator error={null} state={featuredState} />
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2 md:mt-0">
        <Link className="text-sm text-[#173f35] underline-offset-2 hover:underline" href={`/admin/products/${product.id}`}>
          Edit
        </Link>
        <Link className="text-sm text-[#173f35] underline-offset-2 hover:underline" href={`/product/${product.slug}`} target="_blank">
          View
        </Link>
        <form action={duplicateAction}>
          <input name="id" type="hidden" value={product.id} />
          <button className="text-sm text-[#173f35] underline-offset-2 hover:underline" type="submit">
            Duplicate
          </button>
        </form>
        <DeleteProductForm action={deleteAction} id={product.id} />
      </div>
    </article>
  );
}
