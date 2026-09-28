"use client";

import type { ReactNode } from "react";
import Image from "next/image";
import { fillProductDetailsWithAi } from "@/src/lib/catalog/product-ai-actions";
import { isPersistentImageUrl } from "@/src/lib/catalog/image-url";
import {
  isImportedPlaceholderSlug,
  slugifyProductName,
} from "@/src/lib/catalog/product-slug";
import { useState, useRef, type ChangeEvent, type FormEvent } from "react";

export type CategoryOption = { id: string; name: string; slug?: string };

export type ProductValues = {
  id?: string;
  name?: string;
  slug?: string;
  category_id?: string;
  description?: string | null;
  short_description?: string | null;
  price?: number | string | null;
  compare_at_price?: number | string | null;
  sku?: string | null;
  stock_quantity?: number | null;
  track_inventory?: boolean;
  is_active?: boolean;
  is_featured?: boolean;
  is_new_arrival?: boolean;
  is_coming_soon?: boolean;
  product_images?: Array<{ id?: string; image_url?: string | null; position?: number }>;
};

type ImageItem = {
  id?: string;
  url: string;
  isUploading?: boolean;
};

function slugify(text: string): string {
  return slugifyProductName(text);
}

export function ProductForm({
  action,
  categories,
  product,
}: {
  action: (formData: FormData) => Promise<{ success: true; id?: string } | { success: false; error: string; code?: string }>;
  categories: CategoryOption[];
  product?: ProductValues;
}) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  // 1. Basic Info State
  const [name, setName] = useState(product?.name ?? "");
  const [slug, setSlug] = useState(product?.slug ?? "");
  const [isSlugCustomized, setIsSlugCustomized] = useState(() => {
    if (product?.is_active) return true;
    if (!product?.slug) return false;
    return !isImportedPlaceholderSlug(product.slug);
  });
  const [categoryId, setCategoryId] = useState(product?.category_id ?? "");
  const [description, setDescription] = useState(product?.description ?? "");
  const [shortDescription, setShortDescription] = useState(product?.short_description ?? "");
  const [sku, setSku] = useState(product?.sku ?? "");

  // 2. Pricing & Stock State (strictly independent)
  const [price, setPrice] = useState(
    product?.price !== undefined && product?.price !== null ? String(product.price) : "",
  );
  const [compareAtPrice, setCompareAtPrice] = useState(
    product?.compare_at_price !== undefined && product?.compare_at_price !== null
      ? String(product.compare_at_price)
      : "",
  );
  const [stockQuantity, setStockQuantity] = useState(
    product?.stock_quantity !== undefined && product?.stock_quantity !== null
      ? String(product.stock_quantity)
      : "",
  );
  const [trackInventory, setTrackInventory] = useState(product?.track_inventory !== false);

  // 3. Status & Featured State (independent)
  const [isActive, setIsActive] = useState(product?.is_active ?? false);
  const [isFeatured, setIsFeatured] = useState(product?.is_featured ?? false);
  const [isNewArrival, setIsNewArrival] = useState(product?.is_new_arrival ?? false);
  const [isComingSoon, setIsComingSoon] = useState(product?.is_coming_soon ?? false);

  // 4. Images State
  const initialImages: ImageItem[] = (product?.product_images ?? [])
    .slice()
    .sort((a, b) => (a.position ?? 0) - (b.position ?? 0))
    .map((img) => ({ id: img.id, url: img.image_url ?? "" }))
    .filter((img) => Boolean(img.url));

  const [images, setImages] = useState<ImageItem[]>(initialImages);
  const [customImageUrl, setCustomImageUrl] = useState("");
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  // 5. Validation & Submitting State
  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState("");
  const [aiBusy, setAiBusy] = useState(false);
  const [aiMessage, setAiMessage] = useState<string | null>(null);
  const [pendingAiName, setPendingAiName] = useState<string | null>(null);

  // Auto-slug generator when typing name
  function handleNameChange(e: ChangeEvent<HTMLInputElement>) {
    const nextName = e.target.value;
    setName(nextName);
    if (!isSlugCustomized) {
      setSlug(slugify(nextName));
    }
  }

  function handleSlugChange(e: ChangeEvent<HTMLInputElement>) {
    setIsSlugCustomized(true);
    setSlug(slugify(e.target.value));
  }

  async function handleFillWithAi() {
    if (!product?.id || aiBusy || isSaving) return;
    const preserved = {
      categoryId,
      price,
      stockQuantity,
      trackInventory,
      isActive,
    };
    setAiBusy(true);
    setAiMessage(null);
    setPendingAiName(null);
    try {
      const result = await fillProductDetailsWithAi(product.id);
      setCategoryId(preserved.categoryId);
      setPrice(preserved.price);
      setStockQuantity(preserved.stockQuantity);
      setTrackInventory(preserved.trackInventory);
      setIsActive(preserved.isActive);
      if (!result.success) {
        setAiMessage(result.error);
        return;
      }
      if (result.suggestions.shortDescription) setShortDescription(result.suggestions.shortDescription);
      if (result.suggestions.description) setDescription(result.suggestions.description);
      if (result.sku && !String(product.sku ?? "").trim()) setSku(result.sku);
      if (result.replaceName && result.suggestions.name) {
        setName(result.suggestions.name);
        if (!preserved.isActive && (!isSlugCustomized || isImportedPlaceholderSlug(slug) || slug === slugify(name))) {
          setSlug(slugify(result.suggestions.name));
        }
      } else if (result.suggestions.name && result.suggestions.name !== name) {
        setPendingAiName(result.suggestions.name);
      }
      setAiMessage("Review the suggested details, edit anything that needs changing, then Save.");
    } catch {
      setCategoryId(preserved.categoryId);
      setPrice(preserved.price);
      setStockQuantity(preserved.stockQuantity);
      setTrackInventory(preserved.trackInventory);
      setIsActive(preserved.isActive);
      setAiMessage("AI couldn't fill this product. You can enter the details manually or try again. Reference: AI-NET");
    } finally {
      setAiBusy(false);
    }
  }

  function applyPendingAiName() {
    if (!pendingAiName) return;
    setName(pendingAiName);
    if (!product?.is_active && !isSlugCustomized) setSlug(slugify(pendingAiName));
    setPendingAiName(null);
  }

  // Handle native file selection
  async function handleFileSelect(e: ChangeEvent<HTMLInputElement>) {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setUploadError(null);
    setIsUploading(true);

    try {
      const formData = new FormData();
      for (let i = 0; i < files.length; i++) {
        formData.append("files", files[i]);
      }

      const res = await fetch("/api/admin/upload", {
        method: "POST",
        body: formData,
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Image upload failed");
      }

      const newItems: ImageItem[] = (data.urls as string[]).map((url) => ({ url }));
      setImages((prev) => [...prev, ...newItems]);
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : "Failed to upload image.");
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  }

  // Handle adding image via manual URL
  function handleAddImageUrl() {
    const trimmed = customImageUrl.trim();
    if (!trimmed) return;
    if (!isPersistentImageUrl(trimmed)) {
      setUploadError("Enter a persistent HTTP(S) image URL or a site image path.");
      return;
    }
    if (images.some((img) => img.url === trimmed)) {
      setUploadError("This image URL has already been added.");
      return;
    }
    setImages((prev) => [...prev, { url: trimmed }]);
    setCustomImageUrl("");
    setUploadError(null);
  }

  function handleRemoveImage(indexToRemove: number) {
    setImages((prev) => prev.filter((_, idx) => idx !== indexToRemove));
  }

  function handleSetPrimaryImage(indexToPrimary: number) {
    setImages((prev) => {
      const item = prev[indexToPrimary];
      const rest = prev.filter((_, idx) => idx !== indexToPrimary);
      return [item, ...rest];
    });
  }

  // Validate publishing requirements
  function checkPublishingRequirements(): string[] {
    const errors: string[] = [];

    if (!name.trim()) {
      errors.push("Add a product name before publishing.");
    }

    if (!categoryId) {
      errors.push("Add a category before publishing.");
    }

    const numPrice = Number(price);
    if (!price.trim() || !Number.isFinite(numPrice) || numPrice <= 0) {
      errors.push("Add a price before publishing.");
    }

    const numStock = Number(stockQuantity);
    if (trackInventory && (!stockQuantity.trim() || !Number.isFinite(numStock) || !Number.isInteger(numStock) || numStock < 0)) {
      errors.push("Add a valid stock quantity before publishing.");
    }

    if (images.length === 0) {
      errors.push("Add at least one product image before publishing.");
    }

    return errors;
  }

  async function handleSubmit(e: FormEvent<HTMLFormElement>, mode: "draft" | "save" | "activate") {
    e.preventDefault();
    setValidationErrors([]);
    if (isUploading || isSaving || aiBusy) return;
    if (!categoryId) {
      setValidationErrors(["Select a category before saving."]);
      return;
    }

    const saveAsDraft = mode === "draft";
    const willBeActive = mode === "activate" || (mode === "save" && isActive);

    if (willBeActive) {
      const errors = checkPublishingRequirements();
      if (errors.length > 0) {
        setValidationErrors(errors);
        window.scrollTo({ top: 0, behavior: "smooth" });
        return;
      }
    } else if (saveAsDraft) {
      if (!name.trim()) {
        setValidationErrors(["Enter at least a product name to save a draft."]);
        window.scrollTo({ top: 0, behavior: "smooth" });
        return;
      }
    }

    setIsSaving(true);
    setSaveMessage("");

    const formData = new FormData();
    if (product?.id) {
      formData.set("id", product.id);
    }
    formData.set("name", name.trim());
    formData.set("slug", slug.trim() || slugify(name));
    formData.set("category_id", categoryId);
    formData.set("description", description);
    formData.set("short_description", shortDescription);
    formData.set("sku", sku);
    formData.set("price", price);
    formData.set("compare_at_price", compareAtPrice);
    if (trackInventory) {
      formData.set("track_inventory", "on");
      formData.set("stock_quantity", stockQuantity);
    } else {
      formData.set("stock_quantity", "");
    }
    formData.set("status", willBeActive ? "active" : "hidden");
    formData.set("save_as_draft", saveAsDraft ? "true" : "false");
    if (isFeatured) {
      formData.set("is_featured", "on");
    }
    if (isNewArrival) {
      formData.set("is_new_arrival", "on");
    }
    if (isComingSoon) {
      formData.set("is_coming_soon", "on");
    }

    // Pass image URLs
    const allUrls = images.map((img) => img.url);
    formData.set("images_json", JSON.stringify(allUrls));
    if (allUrls.length > 0) {
      formData.set("image_url", allUrls[0]);
      formData.set("gallery_images", allUrls.slice(1).join("\n"));
    }

    try {
      const result = await action(formData);
      if (!result.success) {
        setValidationErrors([result.error]);
        return;
      }
      setSaveMessage("Saved. Price, quantity, category, status, and images were kept.");
    } catch {
      setValidationErrors(["The product could not be saved. Your entries were kept."]);
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <form className="mt-6 max-w-4xl space-y-6" onSubmit={(event) => handleSubmit(event, "save")}>
      {/* Validation Errors Alert */}
      {saveMessage ? (
        <p aria-live="polite" className="rounded-2xl border border-[#173f35]/15 bg-[#173f35]/5 px-4 py-3 text-sm text-[#173f35]">
          {saveMessage}
        </p>
      ) : null}
      {validationErrors.length > 0 && (
        <div
          aria-live="polite"
          className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-900 shadow-sm"
        >
          <div className="flex items-center gap-2 font-semibold text-red-800">
            <span aria-hidden="true">⚠️</span>
            <span>Please complete required fields before publishing:</span>
          </div>
          <ul className="mt-2 list-inside list-disc space-y-1">
            {validationErrors.map((err, i) => (
              <li key={i}>{err}</li>
            ))}
          </ul>
        </div>
      )}

      <div className="grid gap-6 xl:grid-cols-[1.25fr_0.75fr]">
        <div className="space-y-6">
          {/* Section 1: Basic Information */}
          <section className="space-y-4 rounded-2xl border border-[#173f35]/10 bg-[#f9f7f3] p-5">
            <p className="text-[11px] font-medium uppercase tracking-[0.22em] text-[#b8964c]">
              Basic Information
            </p>
            {product?.id ? (
              <div className="space-y-3">
                <button
                  aria-busy={aiBusy}
                  className="inline-flex min-h-11 w-full items-center justify-center rounded-xl border border-[#173f35]/20 bg-white px-4 py-2.5 text-sm font-semibold text-[#173f35] shadow-sm transition hover:bg-white/80 disabled:opacity-60 sm:w-auto"
                  disabled={aiBusy || isSaving || isUploading}
                  onClick={() => void handleFillWithAi()}
                  type="button"
                >
                  {aiBusy ? "✨ Analyzing product..." : "✨ Fill with AI"}
                </button>
                <p className="text-xs text-[#6b6b6b]">
                  AI may suggest name and description in English. Category, price, quantity, and listing status stay as you set them. Review before Save Draft or Activate.
                </p>
                {aiMessage ? (
                  <p aria-live="polite" className="text-sm text-[#173f35]">
                    {aiMessage}{" "}
                    {aiMessage.includes("couldn't fill") ? (
                      <button className="font-semibold underline underline-offset-2" disabled={aiBusy} onClick={() => void handleFillWithAi()} type="button">
                        Try Again
                      </button>
                    ) : null}
                  </p>
                ) : null}
                {pendingAiName ? (
                  <p className="rounded-xl border border-[#173f35]/15 bg-white px-4 py-3 text-sm text-[#173f35]">
                    AI suggested a name: {pendingAiName}.{" "}
                    <button className="font-semibold underline underline-offset-2" onClick={applyPendingAiName} type="button">
                      Use suggestion
                    </button>
                  </p>
                ) : null}
              </div>
            ) : null}

            <label className="block text-sm font-medium text-[#173f35]">
              Product Name <span className="text-red-600">*</span>
              <input
                className="mt-2 w-full rounded-xl border border-[#173f35]/15 bg-white px-4 py-3 text-[#173f35] outline-none transition focus:border-[#173f35]/35"
                onChange={handleNameChange}
                placeholder="e.g. Member's Jasmine Rice 50LB"
                required
                type="text"
                value={name}
              />
            </label>

            <label className="block text-sm font-medium text-[#173f35]">
              Slug (URL Identifier)
              <input
                className="mt-2 w-full rounded-xl border border-[#173f35]/15 bg-white px-4 py-3 text-sm text-[#173f35] outline-none transition focus:border-[#173f35]/35"
                onChange={handleSlugChange}
                placeholder="e.g. members-jasmine-rice-50lb"
                type="text"
                value={slug}
              />
              <span className="mt-1 block text-xs text-[#6b6b6b]">
                Auto-generated from name. Used in the product URL.
              </span>
            </label>

            {/* Category: First-Class Requirement */}
            <label className="block text-sm font-medium text-[#173f35]">
              Category <span className="text-red-600">*</span>
              <select
                className="mt-2 w-full rounded-xl border border-[#173f35]/15 bg-white px-4 py-3 text-[#173f35] outline-none transition focus:border-[#173f35]/35"
                onChange={(e) => setCategoryId(e.target.value)}
                required
                value={categoryId}
              >
                <option value="">Select a category</option>
                {categories.map((cat) => (
                  <option key={cat.id} value={cat.id}>
                    {cat.name}
                  </option>
                ))}
              </select>
              <span className="mt-1 block text-xs text-[#6b6b6b]">
                Required. Choose Foods, Cosmetics, or Ivoire Market. Fill with AI will not change this.
              </span>
            </label>

            <label className="block text-sm font-medium text-[#173f35]">
              SKU (Stock Keeping Unit)
              <input
                className="mt-2 w-full rounded-xl border border-[#173f35]/15 bg-white px-4 py-3 text-[#173f35] outline-none transition focus:border-[#173f35]/35"
                onChange={(e) => setSku(e.target.value)}
                placeholder="Generated on save if left blank"
                readOnly={Boolean(String(product?.sku ?? "").trim())}
                type="text"
                value={sku}
              />
            </label>

            <label className="block text-sm font-medium text-[#173f35]">
              Description
              <textarea
                className="mt-2 min-h-32 w-full rounded-xl border border-[#173f35]/15 bg-white px-4 py-3 text-[#173f35] outline-none transition focus:border-[#173f35]/35"
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Detailed description of the food item, origins, ingredients..."
                value={description}
              />
            </label>

            <label className="block text-sm font-medium text-[#173f35]">
              Short Description / Weight
              <input
                className="mt-2 w-full rounded-xl border border-[#173f35]/15 bg-white px-4 py-3 text-[#173f35] outline-none transition focus:border-[#173f35]/35"
                onChange={(e) => setShortDescription(e.target.value)}
                placeholder="e.g. 50 lb bag, Premium Grade"
                type="text"
                value={shortDescription}
              />
            </label>
          </section>

          {/* Section 2: Pricing (Independent) */}
          <section className="space-y-4 rounded-2xl border border-[#173f35]/10 bg-[#f9f7f3] p-5">
            <p className="text-[11px] font-medium uppercase tracking-[0.22em] text-[#b8964c]">
              Pricing
            </p>
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block text-sm font-medium text-[#173f35]">
                Regular Price ($) <span className="text-red-600">*</span>
                <input
                  className="mt-2 w-full rounded-xl border border-[#173f35]/15 bg-white px-4 py-3 text-[#173f35] outline-none transition focus:border-[#173f35]/35"
                  inputMode="decimal"
                  onChange={(e) => setPrice(e.target.value)}
                  placeholder="0.00"
                  type="text"
                  value={price}
                />
                <span className="mt-1 block text-xs text-[#6b6b6b]">
                  Selling price in customer store. AI will not set this.
                </span>
                {validationErrors.some((error) => error.toLowerCase().includes("price")) ? (
                  <span className="mt-1 block text-sm text-red-700">Add a price before publishing.</span>
                ) : null}
              </label>

              <label className="block text-sm font-medium text-[#173f35]">
                Compare-at / Sale Price ($)
                <input
                  className="mt-2 w-full rounded-xl border border-[#173f35]/15 bg-white px-4 py-3 text-[#173f35] outline-none transition focus:border-[#173f35]/35"
                  inputMode="decimal"
                  onChange={(e) => setCompareAtPrice(e.target.value)}
                  placeholder="0.00"
                  type="text"
                  value={compareAtPrice}
                />
                <span className="mt-1 block text-xs text-[#6b6b6b]">
                  Original price to display crossed-out discount.
                </span>
              </label>
            </div>
          </section>

          {/* Section 3: Inventory (Independent) */}
          <section className="space-y-4 rounded-2xl border border-[#173f35]/10 bg-[#f9f7f3] p-5">
            <p className="text-[11px] font-medium uppercase tracking-[0.22em] text-[#b8964c]">
              Inventory
            </p>
            <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-[#173f35]/10 bg-white p-3">
              <input
                checked={trackInventory}
                className="mt-0.5 h-4 w-4 rounded accent-[#173f35]"
                onChange={(e) => setTrackInventory(e.target.checked)}
                type="checkbox"
              />
              <div>
                <span className="block text-sm font-semibold text-[#173f35]">Track inventory</span>
                <span className="block text-xs text-[#6b6b6b]">
                  When on, quantity is required and checkout reduces stock. When off, quantity is not required and checkout does not change stock.
                </span>
              </div>
            </label>
            {trackInventory ? (
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block text-sm font-medium text-[#173f35]">
                Quantity <span className="text-red-600">*</span>
                <input
                  className="mt-2 w-full rounded-xl border border-[#173f35]/15 bg-white px-4 py-3 text-[#173f35] outline-none transition focus:border-[#173f35]/35"
                  inputMode="numeric"
                  min="0"
                  onChange={(e) => setStockQuantity(e.target.value)}
                  placeholder="0"
                  step="1"
                  type="number"
                  value={stockQuantity}
                />
                <span className="mt-1 block text-xs text-[#6b6b6b]">
                  Whole number of units currently available. Zero means out of stock.
                </span>
              </label>

              <div className="flex flex-col justify-center rounded-xl bg-white p-4 border border-[#173f35]/10">
                <p className="text-xs font-medium text-[#6b6b6b]">Current Stock State</p>
                <p className="mt-1 text-base font-semibold text-[#173f35]">
                  {!stockQuantity.trim()
                    ? "Not set"
                    : Number(stockQuantity) === 0
                      ? "Out of Stock"
                      : Number(stockQuantity) <= 5
                        ? `Low Stock (${stockQuantity} left)`
                        : `In Stock (${stockQuantity} units)`}
                </p>
                <span className="mt-1 text-[11px] text-[#6b6b6b]">
                  Changing stock will never alter or reset your price.
                </span>
              </div>
            </div>
            ) : (
              <p className="rounded-xl border border-[#173f35]/10 bg-white px-4 py-3 text-sm text-[#173f35]">
                Inventory is not tracked for this product.
              </p>
            )}
          </section>

          {/* Section 4: Product Images (File Upload + URL Fallback) */}
          <section className="space-y-4 rounded-2xl border border-[#173f35]/10 bg-[#f9f7f3] p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[11px] font-medium uppercase tracking-[0.22em] text-[#b8964c]">
                  Product Images <span className="text-red-600">*</span>
                </p>
                <p className="text-xs text-[#6b6b6b]">
                  At least 1 image is required for publishing. The first image is the main storefront image.
                </p>
              </div>
            </div>

            {uploadError && (
              <p className="rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-700">
                {uploadError}
              </p>
            )}

            {/* Native Device File Picker Upload */}
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <input
                accept="image/jpeg,image/png,image/webp,image/gif,image/avif"
                className="hidden"
                disabled={isUploading}
                multiple
                onChange={handleFileSelect}
                ref={fileInputRef}
                type="file"
              />

              <button
                className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-xl bg-[#173f35] px-5 py-2.5 text-sm font-medium text-white shadow-sm transition hover:bg-[#143a30] disabled:opacity-50"
                disabled={isUploading}
                onClick={() => fileInputRef.current?.click()}
                type="button"
              >
                <span aria-hidden="true">📷</span>
                {isUploading ? "Uploading Image..." : "Upload Product Image"}
              </button>

              <span className="text-xs text-[#6b6b6b]">
                Select from Photos, Gallery, Files, Downloads
              </span>
            </div>

            {/* Gallery of Uploaded / Current Images */}
            {images.length > 0 ? (
              <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
                {images.map((img, idx) => (
                  <div
                    className={`relative aspect-square overflow-hidden rounded-xl border bg-white shadow-sm transition ${
                      idx === 0
                        ? "border-[#173f35] ring-2 ring-[#173f35]/20"
                        : "border-[#173f35]/15"
                    }`}
                    key={img.url + idx}
                  >
                    <Image
                      alt={`Product preview ${idx + 1}`}
                      className="h-full w-full object-cover"
                      height={120}
                      src={img.url}
                      unoptimized
                      width={120}
                    />

                    {/* Primary Badge */}
                    {idx === 0 && (
                      <span className="absolute left-1.5 top-1.5 rounded-md bg-[#173f35] px-1.5 py-0.5 text-[10px] font-semibold text-white shadow">
                        Main Image
                      </span>
                    )}

                    {/* Action Controls */}
                    <div className="absolute bottom-1.5 right-1.5 flex gap-1">
                      {idx > 0 && (
                        <button
                          className="rounded bg-white/90 px-1.5 py-0.5 text-[10px] font-medium text-[#173f35] shadow hover:bg-white"
                          onClick={() => handleSetPrimaryImage(idx)}
                          title="Set as main image"
                          type="button"
                        >
                          Make Main
                        </button>
                      )}
                      <button
                        className="rounded bg-red-600/90 px-1.5 py-0.5 text-[10px] font-medium text-white shadow hover:bg-red-700"
                        onClick={() => handleRemoveImage(idx)}
                        title="Remove image"
                        type="button"
                      >
                        ✕
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="rounded-xl border border-dashed border-[#173f35]/25 bg-white p-6 text-center text-sm text-[#6b6b6b]">
                No images added yet. Click &quot;Upload Product Image&quot; to pick an image from your device.
              </div>
            )}

            {/* Advanced: Optional Image URL */}
            <details className="mt-3 text-xs text-[#6b6b6b]">
              <summary className="cursor-pointer font-medium text-[#173f35] hover:underline">
                Or enter an image URL (advanced)
              </summary>
              <div className="mt-2 flex gap-2">
                <input
                  className="flex-1 rounded-lg border border-[#173f35]/15 bg-white px-3 py-2 text-xs text-[#173f35]"
                  onChange={(e) => setCustomImageUrl(e.target.value)}
                  placeholder="https://... or /images/..."
                  type="url"
                  value={customImageUrl}
                />
                <button
                  className="rounded-lg bg-[#173f35]/10 px-3 py-2 font-medium text-[#173f35] hover:bg-[#173f35]/20"
                  onClick={handleAddImageUrl}
                  type="button"
                >
                  Add URL
                </button>
              </div>
            </details>
          </section>
        </div>

        {/* Sidebar Controls: Availability & Submit */}
        <div className="space-y-6">
          <section className="rounded-2xl border border-[#173f35]/10 bg-[#f9f7f3] p-5">
            <p className="text-[11px] font-medium uppercase tracking-[0.22em] text-[#b8964c]">
              Availability & Visibility
            </p>

            <div className="mt-4 space-y-4">
              {/* Active Toggle */}
              <label className="flex cursor-pointer items-start gap-3 rounded-xl bg-white p-3 border border-[#173f35]/10">
                <input
                  checked={isActive}
                  className="mt-0.5 h-4 w-4 rounded accent-[#173f35]"
                  onChange={(e) => setIsActive(e.target.checked)}
                  type="checkbox"
                />
                <div>
                  <span className="block text-sm font-semibold text-[#173f35]">
                    Active (Customer Store)
                  </span>
                  <span className="block text-xs text-[#6b6b6b]">
                    When active, product is visible to shoppers in the assigned category. Requires all 5 publishing fields.
                  </span>
                </div>
              </label>

              {/* Featured Toggle */}
              <label className="flex cursor-pointer items-start gap-3 rounded-xl bg-white p-3 border border-[#173f35]/10">
                <input
                  checked={isFeatured}
                  className="mt-0.5 h-4 w-4 rounded accent-[#173f35]"
                  onChange={(e) => setIsFeatured(e.target.checked)}
                  type="checkbox"
                />
                <div>
                  <span className="block text-sm font-semibold text-[#173f35]">
                    Featured Product
                  </span>
                  <span className="block text-xs text-[#6b6b6b]">
                    Show in homepage featured collection and highlights.
                  </span>
                </div>
              </label>
              <label className="flex cursor-pointer items-start gap-3 rounded-xl bg-white p-3 border border-[#173f35]/10">
                <input
                  checked={isNewArrival}
                  className="mt-0.5 h-4 w-4 rounded accent-[#173f35]"
                  onChange={(e) => setIsNewArrival(e.target.checked)}
                  type="checkbox"
                />
                <div>
                  <span className="block text-sm font-semibold text-[#173f35]">New Arrival</span>
                  <span className="block text-xs text-[#6b6b6b]">Shown in New Arrivals only when this product is Active and complete.</span>
                </div>
              </label>
              <label className="flex cursor-pointer items-start gap-3 rounded-xl bg-white p-3 border border-[#173f35]/10">
                <input
                  checked={isComingSoon}
                  className="mt-0.5 h-4 w-4 rounded accent-[#173f35]"
                  onChange={(e) => setIsComingSoon(e.target.checked)}
                  type="checkbox"
                />
                <div>
                  <span className="block text-sm font-semibold text-[#173f35]">Coming Soon</span>
                  <span className="block text-xs text-[#6b6b6b]">Previewed publicly without Add to Cart until the product is Active.</span>
                </div>
              </label>
            </div>
          </section>

          {/* Publishing Checklist Card */}
          <section className="rounded-2xl border border-[#173f35]/10 bg-[#f9f7f3] p-5">
            <p className="text-[11px] font-medium uppercase tracking-[0.22em] text-[#b8964c]">
              Publishing Checklist
            </p>
            <ul className="mt-3 space-y-2 text-xs text-[#6b6b6b]">
              <li className="flex items-center gap-2">
                <span className={name.trim() ? "text-emerald-700 font-bold" : "text-gray-400"}>
                  {name.trim() ? "✓" : "○"}
                </span>
                <span>Product Name</span>
              </li>
              <li className="flex items-center gap-2">
                <span className={categoryId ? "text-emerald-700 font-bold" : "text-gray-400"}>
                  {categoryId ? "✓" : "○"}
                </span>
                <span>Category selected</span>
              </li>
              <li className="flex items-center gap-2">
                <span
                  className={
                    Number(price) > 0 ? "text-emerald-700 font-bold" : "text-gray-400"
                  }
                >
                  {Number(price) > 0 ? "✓" : "○"}
                </span>
                <span>Valid price (&gt; $0.00)</span>
              </li>
              <li className="flex items-center gap-2">
                <span
                  className={
                    !trackInventory ||
                    (stockQuantity.trim() &&
                    Number.isInteger(Number(stockQuantity)) &&
                    Number(stockQuantity) >= 0)
                      ? "text-emerald-700 font-bold"
                      : "text-gray-400"
                  }
                >
                  {!trackInventory ||
                  (stockQuantity.trim() &&
                  Number.isInteger(Number(stockQuantity)) &&
                  Number(stockQuantity) >= 0)
                    ? "✓"
                    : "○"}
                </span>
                <span>{trackInventory ? "Valid stock quantity (≥ 0)" : "Inventory tracking off"}</span>
              </li>
              <li className="flex items-center gap-2">
                <span className={images.length > 0 ? "text-emerald-700 font-bold" : "text-gray-400"}>
                  {images.length > 0 ? "✓" : "○"}
                </span>
                <span>At least one product image</span>
              </li>
            </ul>
          </section>

          {/* Action Buttons */}
          <div className="flex flex-col gap-3">
            <button
              className="inline-flex min-h-[48px] w-full items-center justify-center rounded-xl bg-[#173f35] px-6 py-3 text-sm font-semibold text-white shadow-md transition hover:bg-[#143a30] disabled:opacity-50"
              disabled={isSaving || isUploading}
              onClick={(e) => handleSubmit(e as unknown as FormEvent<HTMLFormElement>, "activate")}
              type="button"
            >
              {isSaving ? "Saving..." : "Approve / Activate"}
            </button>

            <button
              className="inline-flex min-h-[44px] w-full items-center justify-center rounded-xl border border-[#173f35]/20 bg-white px-5 py-2.5 text-sm font-medium text-[#173f35] shadow-sm transition hover:bg-[#f9f7f3] disabled:opacity-50"
              disabled={isSaving || isUploading}
              onClick={(e) => handleSubmit(e as unknown as FormEvent<HTMLFormElement>, "save")}
              type="button"
            >
              {isSaving ? "Saving..." : product?.id ? "Save Changes" : "Create Product"}
            </button>

            <button
              className="inline-flex min-h-[44px] w-full items-center justify-center rounded-xl border border-[#173f35]/20 bg-white px-5 py-2.5 text-sm font-medium text-[#173f35] shadow-sm transition hover:bg-[#f9f7f3] disabled:opacity-50"
              disabled={isSaving || isUploading}
              onClick={(e) => handleSubmit(e as unknown as FormEvent<HTMLFormElement>, "draft")}
              type="button"
            >
              Save Draft
            </button>
          </div>
        </div>
      </div>
    </form>
  );
}


export function FormNotice({ children }: { children: ReactNode }) {
  return <p className="mt-4 rounded-xl border border-[#173f35]/15 bg-[#f9f7f3] px-4 py-3 text-sm text-[#173f35]">{children}</p>;
}
