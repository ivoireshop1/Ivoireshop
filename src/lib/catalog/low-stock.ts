/** Shared inventory low-stock rule used by admin inventory, dashboard, and printing. */
export const LOW_STOCK_MAX_UNITS = 5;

export function isLowStock(trackInventory: boolean | null | undefined, stockQuantity: number | string | null | undefined) {
  if (trackInventory === false) return false;
  if (stockQuantity === null || stockQuantity === undefined || stockQuantity === "") return false;
  const stock = Number(stockQuantity);
  return Number.isFinite(stock) && stock > 0 && stock <= LOW_STOCK_MAX_UNITS;
}
