export const SKU_PREFIX_BY_SLUG = {
  foods: "FOOD",
  cosmetics: "COS",
  "ivoire-market": "IVM",
} as const;

export function skuPrefixForCategorySlug(slug: string | null | undefined) {
  if (slug === "foods" || slug === "cosmetics" || slug === "ivoire-market") {
    return SKU_PREFIX_BY_SLUG[slug];
  }
  return null;
}

export function skuFromProductId(prefix: string, productId: string, taken: Iterable<string> = []) {
  const used = new Set(Array.from(taken).filter(Boolean));
  const compact = String(productId).replace(/-/g, "").toUpperCase().replace(/[^A-Z0-9]/g, "");
  const base = compact || "X0000";
  for (let length = 5; length <= Math.max(5, base.length); length++) {
    const candidate = `${prefix}-${base.slice(0, length)}`;
    if (!used.has(candidate)) return candidate;
  }
  let serial = 2;
  let candidate = `${prefix}-${base.slice(0, 5)}${serial}`;
  while (used.has(candidate)) {
    serial += 1;
    candidate = `${prefix}-${base.slice(0, 5)}${serial}`;
  }
  return candidate;
}

export function resolvePersistedSku(input: {
  existingSku: string | null | undefined;
  submittedSku: string | null | undefined;
  categorySlug: string | null | undefined;
  productId: string;
  takenSkus: Iterable<string>;
}) {
  const existing = String(input.existingSku ?? "").trim();
  if (existing) return { sku: existing, generated: false };

  const submitted = String(input.submittedSku ?? "").trim();
  if (submitted) return { sku: submitted, generated: false };

  const prefix = skuPrefixForCategorySlug(input.categorySlug);
  if (!prefix) return { sku: null, generated: false };

  return {
    sku: skuFromProductId(prefix, input.productId, input.takenSkus),
    generated: true,
  };
}
