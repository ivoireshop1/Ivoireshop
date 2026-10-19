import type { SellingMethod, SellingUnit } from "@/src/lib/catalog/selling";

export type CartItem = {
  productId: string;
  slug: string;
  name: string;
  price: number;
  compareAtPrice?: number;
  image: string;
  quantity: number;
  sellingMethod?: SellingMethod;
  sellingUnit?: SellingUnit;
  unitIncrement?: number;
  minSellQty?: number;
  maxSellQty?: number | null;
};
