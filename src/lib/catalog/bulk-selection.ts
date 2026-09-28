import { CANONICAL_CATEGORIES, isCanonicalSlug } from "@/src/lib/catalog/canonical-categories";

export function toggleSelectedId(selected: string[], id: string) {
  if (selected.includes(id)) return selected.filter((item) => item !== id);
  return [...selected, id];
}

export function selectAllVisible(visibleIds: string[]) {
  return [...new Set(visibleIds)];
}

export function clearSelection() {
  return [] as string[];
}

export function isVisibleSelectionComplete(selected: string[], visibleIds: string[]) {
  return visibleIds.length > 0 && visibleIds.every((id) => selected.includes(id));
}

export function bulkMoveConfirmation(count: number, categoryName: string) {
  return `Move ${count} selected product${count === 1 ? "" : "s"} to ${categoryName}?`;
}

export function isBulkTargetSlug(slug: string) {
  return isCanonicalSlug(slug) && CANONICAL_CATEGORIES.some((category) => category.slug === slug);
}

export function fieldsPreservedByCategoryMove() {
  return [
    "price",
    "stock_quantity",
    "track_inventory",
    "is_active",
    "is_featured",
    "is_new_arrival",
    "is_coming_soon",
    "slug",
  ] as const;
}
