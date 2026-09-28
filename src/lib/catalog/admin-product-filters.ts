import { productMissingRequirements, productNeedsReview } from "@/src/lib/catalog/product-readiness";
import { isInventoryTracked } from "@/src/lib/catalog/inventory";

export type AdminProductFilterInput = {
  name: string;
  categoryId: string | null;
  categoryName?: string | null;
  price: number | string | null;
  stockQuantity: number | string | null;
  trackInventory?: boolean | null;
  needsCategoryReview?: boolean | null;
  isActive: boolean;
  isComingSoon?: boolean | null;
  isFeatured?: boolean | null;
  needsPricing?: boolean | null;
  imageUrl?: string | null;
  images?: Array<{ image_url?: string | null } | null> | null;
};

export function matchesAdminReviewFilter(filter: string, product: AdminProductFilterInput) {
  const missing = productMissingRequirements(product);
  if (filter === "all") return true;
  if (filter === "needs-review") return productNeedsReview(product);
  if (filter === "category") return Boolean(product.needsCategoryReview);
  if (filter === "missing_price") return missing.includes("Price") || Boolean(product.needsPricing);
  if (filter === "missing_image") return missing.includes("Image");
  if (filter === "inventory") {
    return isInventoryTracked(product.trackInventory) && missing.includes("Inventory");
  }
  if (filter === "draft") return !product.isActive;
  if (filter === "coming_soon") return Boolean(product.isComingSoon);
  return true;
}
