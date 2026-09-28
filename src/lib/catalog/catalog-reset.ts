export const UNLIST_CONFIRMATION = "Unlist every product from the customer store?";
export const CLEAR_PRICES_CONFIRMATION = "Clear prices from all products?";
export const CLEAR_PRICES_PHRASE = "CLEAR PRICES";
export const FRESH_START_PHRASE = "FRESH START";
export const RESTORE_PHRASE = "RESTORE";
export const FRESH_RESET_SUCCESS = "Catalog reset complete. Products are organized and ready for pricing.";
export const CATALOG_PREPARING_TITLE = "Products are being prepared.";
export const CATALOG_PREPARING_BODY = "Please check back soon.";

export type CatalogImpact = {
  total: number;
  active: number;
  foods: number;
  cosmetics: number;
  ivoireMarket: number;
  withPrices: number;
  inventoryTracked: number;
};

export type CatalogSnapshotMeta = {
  id: string;
  createdAt: string;
  itemCount: number;
  reason: string;
};

const emptyImpact: CatalogImpact = {
  total: 0,
  active: 0,
  foods: 0,
  cosmetics: 0,
  ivoireMarket: 0,
  withPrices: 0,
  inventoryTracked: 0,
};

function asCount(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? Math.trunc(parsed) : 0;
}

export function parseCatalogImpact(value: unknown): CatalogImpact {
  if (!value || typeof value !== "object") return emptyImpact;
  const row = value as Record<string, unknown>;
  return {
    total: asCount(row.total),
    active: asCount(row.active),
    foods: asCount(row.foods),
    cosmetics: asCount(row.cosmetics),
    ivoireMarket: asCount(row.ivoire_market ?? row.ivoireMarket),
    withPrices: asCount(row.with_prices ?? row.withPrices),
    inventoryTracked: asCount(row.inventory_tracked ?? row.inventoryTracked),
  };
}

export function parseCatalogSnapshotMeta(value: unknown): CatalogSnapshotMeta | null {
  if (!value || typeof value !== "object") return null;
  const row = value as Record<string, unknown>;
  if (typeof row.id !== "string" || !row.id) return null;
  return {
    id: row.id,
    createdAt: typeof row.created_at === "string" ? row.created_at : typeof row.createdAt === "string" ? row.createdAt : "",
    itemCount: asCount(row.item_count ?? row.itemCount),
    reason: typeof row.reason === "string" ? row.reason : "fresh_reset",
  };
}

export function formatCatalogImpact(impact: CatalogImpact) {
  return [
    `${impact.total} total products`,
    `${impact.active} currently active`,
    `${impact.foods} Foods`,
    `${impact.cosmetics} Cosmetics`,
    `${impact.ivoireMarket} Ivoire Market`,
    `${impact.withPrices} products with prices`,
    `${impact.inventoryTracked} inventory-tracked products`,
  ];
}

export function confirmationMatches(input: string, expected: string) {
  return input.trim() === expected;
}

export function bulkPriceConfirmation(count: number, priceLabel: string) {
  return `Set price ${priceLabel} on ${count} selected product${count === 1 ? "" : "s"}?`;
}

export function bulkActivateConfirmation(count: number) {
  return `Activate ${count} eligible selected product${count === 1 ? "" : "s"}?`;
}

export function isBulkActivateEligible(product: {
  name?: string | null;
  hasCategory?: boolean;
  hasImage?: boolean;
  price?: number | string | null;
  stockQuantity?: number | string | null;
  trackInventory?: boolean | null;
}) {
  if (!product.name?.trim()) return false;
  if (!product.hasCategory) return false;
  if (!product.hasImage) return false;
  const price = product.price === null || product.price === undefined || product.price === "" ? null : Number(product.price);
  if (price === null || !Number.isFinite(price) || price <= 0) return false;
  if (product.trackInventory === false) return true;
  const stock =
    product.stockQuantity === null || product.stockQuantity === undefined || product.stockQuantity === ""
      ? null
      : Number(product.stockQuantity);
  return stock !== null && Number.isInteger(stock) && stock >= 0;
}

export const FRESH_RESET_EFFECTS = [
  "Every product is unlisted (is_active = false).",
  "Every price is cleared to blank (NULL), not 0.00.",
  "Inventory tracking is turned off and quantity is cleared.",
  "Featured, New Arrival, and Coming Soon flags are turned off.",
  "Product IDs, names, descriptions, SKUs, slugs, images, and category assignments stay in place.",
  "Foods stays Foods. Cosmetics stays Cosmetics. Ivoire Market stays Ivoire Market.",
  "Customers, orders, reviews, and historical order prices are not changed.",
] as const;
