import { isNextImageSrc } from "@/src/lib/catalog/image-url";
import { toOneRelation } from "@/src/lib/catalog/relation-utils";

export type OrderLineItem = {
  product_id?: string | null;
  product_name: string;
  product_price: number | string;
  quantity: number;
  image_url?: string | null;
  catalog_image_url?: string | null;
};

type NestedProductImages = {
  product_images?: Array<{ image_url: string; position: number }> | null;
};

export function catalogImageFromProduct(products?: NestedProductImages | NestedProductImages[] | null) {
  const product = toOneRelation(products);
  const images = product?.product_images;
  if (!images?.length) return null;
  const first = [...images].sort((a, b) => a.position - b.position)[0];
  return first?.image_url ?? null;
}

export function toOrderLineItem(item: OrderLineItem & { products?: NestedProductImages | NestedProductImages[] | null }): OrderLineItem {
  return {
    product_id: item.product_id,
    product_name: item.product_name,
    product_price: item.product_price,
    quantity: item.quantity,
    image_url: item.image_url,
    catalog_image_url: item.catalog_image_url ?? catalogImageFromProduct(item.products),
  };
}

export function orderLineImage(item: OrderLineItem) {
  const snapshot = typeof item.image_url === "string" ? item.image_url.trim() : "";
  if (snapshot && isNextImageSrc(snapshot)) return snapshot;
  const fallback = typeof item.catalog_image_url === "string" ? item.catalog_image_url.trim() : "";
  if (!snapshot && fallback && isNextImageSrc(fallback)) return fallback;
  return "";
}
