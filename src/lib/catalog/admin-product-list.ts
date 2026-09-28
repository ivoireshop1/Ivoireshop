import { CANONICAL_CATEGORIES } from "@/src/lib/catalog/canonical-categories";

export type AdminCategoryRecord = {
  id: string;
  name: string;
  slug?: string | null;
  is_active?: boolean | null;
};

export function categoryNameFromId(
  categoryId: string | null | undefined,
  categories: AdminCategoryRecord[],
) {
  if (!categoryId) return "Uncategorized";
  return categories.find((category) => category.id === categoryId)?.name ?? "Uncategorized";
}

export function categorySlugFromId(
  categoryId: string | null | undefined,
  categories: AdminCategoryRecord[],
) {
  if (!categoryId) return null;
  return categories.find((category) => category.id === categoryId)?.slug ?? null;
}

export function matchesAdminCategoryFilter(
  filter: string,
  product: { categoryId: string | null | undefined },
  categories: AdminCategoryRecord[],
) {
  if (!filter || filter === "all") return true;
  if (product.categoryId === filter) return true;
  return categorySlugFromId(product.categoryId, categories) === filter;
}

export function canonicalCategoryTabCounts(
  products: Array<{ categoryId: string | null | undefined }>,
  categories: AdminCategoryRecord[],
) {
  const counts = {
    all: products.length,
    cosmetics: 0,
    foods: 0,
    "ivoire-market": 0,
  };
  for (const product of products) {
    const slug = categorySlugFromId(product.categoryId, categories);
    if (slug === "cosmetics") counts.cosmetics += 1;
    if (slug === "foods") counts.foods += 1;
    if (slug === "ivoire-market") counts["ivoire-market"] += 1;
  }
  return counts;
}

export function adminProductsHref(input: {
  category?: string;
  status?: string;
  inventory?: string;
  search?: string;
  featured?: string;
  review?: string;
}) {
  const params = new URLSearchParams();
  if (input.search) params.set("search", input.search);
  if (input.status && input.status !== "all") params.set("status", input.status);
  if (input.inventory && input.inventory !== "all") params.set("inventory", input.inventory);
  if (input.category && input.category !== "all") params.set("category", input.category);
  if (input.featured && input.featured !== "all") params.set("featured", input.featured);
  if (input.review && input.review !== "all") params.set("review", input.review);
  const query = params.toString();
  return query ? `/admin/products?${query}` : "/admin/products";
}

export const ADMIN_CATEGORY_TABS = [
  { slug: "all", label: "All" },
  ...CANONICAL_CATEGORIES.map((category) => ({ slug: category.slug, label: category.name })),
] as const;
