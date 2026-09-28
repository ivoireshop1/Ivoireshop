export function slugifyProductName(value: string) {
  return String(value ?? "")
    .toLowerCase()
    .trim()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

export function isImportedPlaceholderSlug(slug: string) {
  return /^src-[a-f0-9]{8,}/i.test(String(slug ?? "").trim());
}

export function uniqueProductSlug(base: string, taken: Iterable<string>) {
  const used = new Set(Array.from(taken).filter(Boolean));
  const normalized = slugifyProductName(base) || "product";
  if (!used.has(normalized)) return normalized;
  let serial = 2;
  let candidate = `${normalized}-${serial}`;
  while (used.has(candidate)) {
    serial += 1;
    candidate = `${normalized}-${serial}`;
  }
  return candidate;
}

export function adminProductViewHref(product: { id: string; slug: string; isActive: boolean }) {
  if (product.isActive) return `/product/${encodeURIComponent(product.slug)}`;
  return `/admin/products/${product.id}/preview`;
}

export function adminProductViewLabel(isActive: boolean) {
  return isActive ? "View Storefront" : "Preview";
}
