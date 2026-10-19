export type CatalogCategory = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  imageUrl: string | null;
  isActive: boolean;
  parentId?: string | null;
  sortOrder?: number;
};

export type CatalogProduct = {
  id: string;
  categoryId: string;
  name: string;
  slug: string;
  description: string | null;
  priceInCents: number;
  currency: string;
  inventoryQuantity: number;
  imageUrl: string | null;
  isActive: boolean;
};

export interface Product {
  id: string;
  slug: string;
  name: string;
  description: string;
  shortDescription: string;
  price: number;
  compareAtPrice?: number;
  category: string;
  categorySlug?: string;
  subcategory?: string;
  subcategorySlug?: string;
  image: string;
  weight: string;
  stockQuantity?: number | null;
  trackInventory?: boolean;
  isFeatured: boolean;
  isNew: boolean;
  isPopular: boolean;
  isComingSoon?: boolean;
  sellingMethod?: "each" | "weight" | "fixed_package";
  sellingUnit?: "each" | "lb" | "kg" | "oz" | "bag" | "pack";
  unitIncrement?: number;
  minSellQty?: number;
  maxSellQty?: number | null;
  packageWeightLb?: number | null;
}
