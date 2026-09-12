import type { Product } from "@/src/types/catalog";

export type WishlistItem = {
  id: string;
  productId: string;
  product?: Product;
};
