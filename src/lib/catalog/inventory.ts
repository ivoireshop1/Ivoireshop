export const UNTRACKED_CART_LINE_LIMIT = 20;

export function isInventoryTracked(trackInventory?: boolean | null) {
  return trackInventory !== false;
}

export function remainingPurchasableQuantity(
  trackInventory: boolean | null | undefined,
  stockQuantity: number | null | undefined,
  alreadyInCart = 0,
) {
  if (!isInventoryTracked(trackInventory)) {
    return Math.max(0, UNTRACKED_CART_LINE_LIMIT - alreadyInCart);
  }
  if (stockQuantity == null || !Number.isFinite(Number(stockQuantity))) return 0;
  return Math.max(0, Number(stockQuantity) - alreadyInCart);
}

export function publicStockLabel(trackInventory: boolean | null | undefined, stockQuantity: number | null | undefined) {
  if (!isInventoryTracked(trackInventory)) return "Inventory not tracked";
  if (stockQuantity == null) return "Availability pending";
  if (stockQuantity === 0) return "Out of stock";
  return `${stockQuantity} in stock`;
}

export function productIsSoldOut(trackInventory: boolean | null | undefined, stockQuantity: number | null | undefined) {
  if (!isInventoryTracked(trackInventory)) return false;
  return stockQuantity == null || Number(stockQuantity) <= 0;
}
