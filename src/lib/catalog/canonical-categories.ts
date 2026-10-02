export const CANONICAL_CATEGORIES = [
  { name: "Cosmetics", slug: "cosmetics" },
  { name: "Foods", slug: "foods" },
  { name: "Ivoire Market", slug: "ivoire-market" },
] as const;

const ALIASES: Record<string, string> = {
  cosmetic: "cosmetics",
  cosmetics: "cosmetics",
  beauty: "cosmetics",
  "beauty-personal-care": "cosmetics",
  "personal-care": "cosmetics",
  food: "foods",
  foods: "foods",
  grocery: "foods",
  groceries: "foods",
  "ivoire-market": "ivoire-market",
  "ivoiremarket": "ivoire-market",
};

function normalizeKey(value: string) {
  return value.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}

export function canonicalSlugForName(name: string, slug?: string) {
  const fromSlug = ALIASES[normalizeKey(slug || "")];
  if (fromSlug) return fromSlug;
  return ALIASES[normalizeKey(name)] ?? null;
}

export function isCanonicalSlug(slug: string) {
  return CANONICAL_CATEGORIES.some((category) => category.slug === slug);
}

export function canonicalSortIndex(name: string, slug?: string) {
  const resolved = slug && isCanonicalSlug(slug) ? slug : canonicalSlugForName(name, slug);
  const index = CANONICAL_CATEGORIES.findIndex((category) => category.slug === resolved);
  return index === -1 ? CANONICAL_CATEGORIES.length : index;
}

export function shopCategoryQueryMatches(
  query: string,
  category: { name: string; slug?: string | null },
) {
  const needle = query.trim().toLowerCase();
  if (!needle || needle === "all" || needle === "all products") return true;
  if (category.name.toLowerCase() === needle) return true;
  if ((category.slug ?? "").toLowerCase() === needle) return true;
  const left = canonicalSlugForName(category.name, category.slug ?? undefined);
  const right = canonicalSlugForName(query, query);
  return Boolean(left && right && left === right);
}

export function isAssignableCategory(
  category: { id: string; name?: string; slug?: string; is_active?: boolean },
  currentId?: string | null,
) {
  if (category.id === currentId) return true;
  return category.is_active !== false;
}

export function categoriesForProductAssignment<T extends { id: string; name?: string; slug?: string; is_active?: boolean }>(
  categories: T[],
  currentId?: string | null,
) {
  return categories
    .filter((category) => isAssignableCategory(category, currentId))
    .sort((left, right) => {
      const byCanonical = canonicalSortIndex(left.name ?? "", left.slug) - canonicalSortIndex(right.name ?? "", right.slug);
      if (byCanonical !== 0) return byCanonical;
      return (left.name ?? "").localeCompare(right.name ?? "");
    });
}
