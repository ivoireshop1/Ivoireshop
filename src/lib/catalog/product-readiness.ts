import { isPersistentImageUrl } from "@/src/lib/catalog/image-url";

export type ProductReadinessInput = {
  name?: string | null;
  categoryId?: string | null;
  categoryName?: string | null;
  price?: number | string | null;
  stockQuantity?: number | string | null;
  isActive?: boolean;
  imageUrl?: string | null;
  images?: Array<{ image_url?: string | null } | null> | null;
};

export function productMissingRequirements(product: ProductReadinessInput) {
  const missing: string[] = [];
  if (!product.name?.trim()) missing.push("Name");
  const hasCategory = Boolean(product.categoryId || (product.categoryName && product.categoryName !== "Uncategorized"));
  if (!hasCategory) missing.push("Category");
  const price = product.price === null || product.price === undefined || product.price === "" ? null : Number(product.price);
  if (price === null || !Number.isFinite(price) || price <= 0) missing.push("Price");
  const stock =
    product.stockQuantity === null || product.stockQuantity === undefined || product.stockQuantity === ""
      ? null
      : Number(product.stockQuantity);
  if (stock === null || !Number.isInteger(stock) || stock < 0) missing.push("Inventory");
  const hasImage =
    (typeof product.imageUrl === "string" && isPersistentImageUrl(product.imageUrl)) ||
    Boolean(product.images?.some((image) => typeof image?.image_url === "string" && isPersistentImageUrl(image.image_url)));
  if (!hasImage) missing.push("Image");
  return missing;
}

export function productNeedsReview(product: ProductReadinessInput) {
  return !product.isActive || productMissingRequirements(product).length > 0;
}

export function productReadyToPublish(product: ProductReadinessInput) {
  return !product.isActive && productMissingRequirements(product).length === 0;
}
