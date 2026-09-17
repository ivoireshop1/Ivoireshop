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

export interface Product {
  id: string;
  slug: string;
  name: string;
  description: string;
  shortDescription: string;
  price: number;
  compareAtPrice?: number;
  category: string;
  image: string;
  weight: string;
  isFeatured: boolean;
  isNew: boolean;
  isPopular: boolean;
}
