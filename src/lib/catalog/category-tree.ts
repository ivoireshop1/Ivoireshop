export type CategoryNode = {
  id: string;
  name: string;
  slug: string;
  description?: string | null;
  image_url?: string | null;
  is_active?: boolean | null;
  parent_id?: string | null;
  sort_order?: number | null;
};

export function isRootCategory(category: Pick<CategoryNode, "parent_id">) {
  return !category.parent_id;
}

export function childrenOf(parentId: string, categories: CategoryNode[]) {
  return categories
    .filter((category) => category.parent_id === parentId)
    .sort((left, right) => (left.sort_order ?? 0) - (right.sort_order ?? 0) || left.name.localeCompare(right.name));
}

export function rootCategories(categories: CategoryNode[]) {
  const hasParents = categories.some((category) => category.parent_id);
  const roots = hasParents ? categories.filter((category) => isRootCategory(category)) : categories;
  return roots.sort((left, right) => (left.sort_order ?? 0) - (right.sort_order ?? 0) || left.name.localeCompare(right.name));
}

export function shopMatchesCategory(input: {
  selected: string;
  categorySlug?: string | null;
  subcategorySlug?: string | null;
  parentSlug?: string | null;
}) {
  const selected = input.selected.trim();
  if (!selected || selected === "All" || selected === "All Products") return true;
  const haystack = [input.categorySlug, input.subcategorySlug, input.parentSlug]
    .filter(Boolean)
    .map((value) => String(value).toLowerCase());
  return haystack.includes(selected.toLowerCase());
}

export function resolveSubcategoryParent(
  subcategoryId: string | null | undefined,
  categories: CategoryNode[],
) {
  if (!subcategoryId) return null;
  const child = categories.find((category) => category.id === subcategoryId);
  if (!child?.parent_id) return null;
  return categories.find((category) => category.id === child.parent_id) ?? null;
}
