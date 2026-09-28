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

export function canonicalSortIndex(name: string) {
  const index = CANONICAL_CATEGORIES.findIndex((category) => category.name === name);
  return index === -1 ? CANONICAL_CATEGORIES.length : index;
}

export function categoriesForProductAssignment<T extends { id: string; is_active?: boolean }>(categories: T[], currentId?: string | null) {
  return categories.filter((category) => category.is_active || category.id === currentId);
}
