export type CatalogCategory = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  imageUrl: string | null;
  isActive: boolean;
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

export const productCategories = [
  "Rice & Grains",
  "African Foods",
  "Fresh Produce",
  "Oils & Cooking",
  "Spices & Seasoning",
  "Drinks",
  "Snacks",
] as const;

export type ProductCategory = (typeof productCategories)[number];

export interface Product {
  id: string;
  slug: string;
  name: string;
  description: string;
  shortDescription: string;
  price: number;
  compareAtPrice?: number;
  category: ProductCategory;
  image: string;
  weight: string;
  isFeatured: boolean;
  isNew: boolean;
  isPopular: boolean;
}
