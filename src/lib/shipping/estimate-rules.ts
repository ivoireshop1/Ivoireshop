import { ozToLb } from "../catalog/shipping-weight.ts";
import { parseSellingMethod } from "../catalog/selling.ts";
import { parsePositive } from "../delivery/package.ts";

/**
 * Extra ounces added to selected produce pounds when the product has no saved packaging weight.
 * 0 until Admin configures a real allowance. Never treated as a verified carton.
 */
export const PRODUCE_PACKAGING_ALLOWANCE_OZ = 0;

/** Quote-time buffer applied only to identified estimates, never to verified weights. */
export const ESTIMATE_WEIGHT_BUFFER = 1.1;

export type CategoryShippingDefault = {
  weightOz: number;
  packagingOz?: number;
  label: string;
};

/**
 * Explicit checkout estimates only. Never persisted as verified measurements.
 * Packaging ounces on the product are preferred so this default does not double-count tare.
 */
export const CATEGORY_SHIPPING_DEFAULTS: Record<string, CategoryShippingDefault> = {
  "ivoire-market": { weightOz: 24, label: "Ivoire Market category estimate · 1.5 lb" },
  foods: { weightOz: 24, label: "Foods category estimate · 1.5 lb" },
  cosmetics: { weightOz: 8, label: "Cosmetics category estimate · 0.5 lb" },
  "beauty-personal-care": { weightOz: 8, label: "Beauty category estimate · 0.5 lb" },
  "fresh-produce": { weightOz: 16, label: "Produce category estimate · 1 lb" },
};

const CATEGORY_PREFIXES = ["ivoire-market", "beauty-personal-care", "cosmetics", "foods", "fresh-produce"] as const;

export function lookupCategoryDefault(
  categoryKey?: string | null,
  defaults: Record<string, CategoryShippingDefault> = CATEGORY_SHIPPING_DEFAULTS,
) {
  const key = String(categoryKey ?? "").trim().toLowerCase();
  if (!key) return null;
  if (defaults[key]) return defaults[key];
  const prefix = CATEGORY_PREFIXES.find((item) => key === item || key.startsWith(`${item}-`));
  return prefix ? defaults[prefix] ?? null : null;
}

export function producePackagingAllowanceLb(product: {
  selling_method?: string | null;
  packaging_weight_oz?: number | string | null;
  package_weight_lb?: number | string | null;
}) {
  const fromOz = parsePositive(product.packaging_weight_oz);
  if (fromOz != null) return ozToLb(fromOz);
  const fromLb = parsePositive(product.package_weight_lb);
  if (fromLb != null) return fromLb;
  if (parseSellingMethod(product.selling_method) !== "weight") return 0;
  return ozToLb(PRODUCE_PACKAGING_ALLOWANCE_OZ);
}

export function categoryEstimateWeightLb(
  categoryKey?: string | null,
  defaults: Record<string, CategoryShippingDefault> = CATEGORY_SHIPPING_DEFAULTS,
  packagingOz?: number | null,
) {
  const row = lookupCategoryDefault(categoryKey, defaults);
  if (!row || !(row.weightOz > 0)) return null;
  const packOz = packagingOz != null && packagingOz > 0
    ? packagingOz
    : (row.packagingOz && row.packagingOz > 0 ? row.packagingOz : 0);
  return Number((((row.weightOz + packOz) / 16) * ESTIMATE_WEIGHT_BUFFER).toFixed(3));
}
