import { isPersistentImageUrl } from "@/src/lib/catalog/image-url";

export type MerchProduct = {
  isActive?: boolean | null;
  isNewArrival?: boolean | null;
  isComingSoon?: boolean | null;
  price?: number | string | null;
  categoryId?: string | null;
  categoryName?: string | null;
  imageUrl?: string | null;
  images?: Array<{ image_url?: string | null } | null> | null;
  name?: string | null;
};

function hasCategory(product: MerchProduct) {
  return Boolean(product.categoryId || (product.categoryName && product.categoryName !== "Uncategorized"));
}

function hasImage(product: MerchProduct) {
  if (typeof product.imageUrl === "string" && isPersistentImageUrl(product.imageUrl)) return true;
  return Boolean(product.images?.some((image) => typeof image?.image_url === "string" && isPersistentImageUrl(image.image_url)));
}

function hasPurchasablePrice(product: MerchProduct) {
  const price = product.price === null || product.price === undefined || product.price === "" ? null : Number(product.price);
  return price !== null && Number.isFinite(price) && price > 0;
}

export function isPublicNewArrival(product: MerchProduct) {
  return Boolean(product.isNewArrival) && Boolean(product.isActive) && hasPurchasablePrice(product) && hasCategory(product) && hasImage(product);
}

export function isPublicComingSoon(product: MerchProduct) {
  return Boolean(product.isComingSoon) && !product.isActive && hasCategory(product) && hasImage(product) && Boolean(product.name?.trim());
}

export function isPurchasableCatalogProduct(product: MerchProduct) {
  return Boolean(product.isActive) && hasPurchasablePrice(product) && hasCategory(product) && hasImage(product);
}
