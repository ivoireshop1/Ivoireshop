import type { CartItem } from "@/src/types/cart";
import {
  lineSubtotal,
  parseSellingMethod,
  parseSellingUnit,
  roundMoney,
  roundQty,
  snapQuantity,
  type SellingSettings,
} from "@/src/lib/catalog/selling";

export function settingsFromCartItem(item: Pick<CartItem, "sellingMethod" | "sellingUnit" | "unitIncrement" | "minSellQty" | "maxSellQty">): SellingSettings {
  const sellingMethod = parseSellingMethod(item.sellingMethod);
  const unitIncrement = item.unitIncrement && item.unitIncrement > 0
    ? item.unitIncrement
    : sellingMethod === "weight" ? 0.5 : 1;
  const minSellQty = item.minSellQty && item.minSellQty > 0 ? item.minSellQty : unitIncrement;
  return {
    sellingMethod,
    sellingUnit: sellingMethod === "each" ? "each" : parseSellingUnit(item.sellingUnit ?? "lb"),
    unitIncrement,
    minSellQty,
    maxSellQty: item.maxSellQty ?? null,
    packageWeightLb: null,
  };
}

export function normalizeCart(items: unknown): CartItem[] {
  const value = Array.isArray(items) ? items : Array.isArray((items as { items?: unknown })?.items) ? (items as { items: unknown[] }).items : [];

  return value.filter(isCartItem).map((item) => {
    const settings = settingsFromCartItem(item);
    return {
      ...item,
      sellingMethod: settings.sellingMethod,
      sellingUnit: settings.sellingUnit,
      unitIncrement: settings.unitIncrement,
      minSellQty: settings.minSellQty,
      maxSellQty: settings.maxSellQty,
      quantity: snapQuantity(item.quantity, settings),
    };
  });
}

function isCartItem(item: unknown): item is CartItem {
  if (!item || typeof item !== "object") return false;
  const value = item as Record<string, unknown>;
  return typeof value.productId === "string" && typeof value.slug === "string" && typeof value.name === "string" &&
    typeof value.price === "number" && Number.isFinite(value.price) && typeof value.image === "string" &&
    typeof value.quantity === "number" && Number.isFinite(value.quantity) && value.quantity > 0;
}

export function itemCount(items: CartItem[]) {
  return items.reduce((total, item) => {
    const method = parseSellingMethod(item.sellingMethod);
    if (method === "weight") return total + 1;
    return total + item.quantity;
  }, 0);
}

export function subtotal(items: CartItem[]) {
  return roundMoney(items.reduce((total, item) => total + lineSubtotal(item.price, item.quantity), 0));
}

export function subtractPurchasedItems(items: CartItem[], purchased: { productId: string; quantity: number }[]) {
  const quantities = new Map<string, number>();
  for (const item of purchased) quantities.set(item.productId, roundQty((quantities.get(item.productId) ?? 0) + item.quantity));
  return items.flatMap((item) => {
    const quantity = roundQty(item.quantity - (quantities.get(item.productId) ?? 0));
    return quantity > 0 ? [{ ...item, quantity }] : [];
  });
}

export function mergeItem(items: CartItem[], item: CartItem) {
  const settings = settingsFromCartItem(item);
  const existing = items.find((entry) => entry.productId === item.productId);
  if (!existing) {
    return [...items, {
      ...item,
      sellingMethod: settings.sellingMethod,
      sellingUnit: settings.sellingUnit,
      unitIncrement: settings.unitIncrement,
      minSellQty: settings.minSellQty,
      maxSellQty: settings.maxSellQty,
      quantity: snapQuantity(item.quantity, settings),
    }];
  }
  const mergedSettings = settingsFromCartItem({
    sellingMethod: item.sellingMethod ?? existing.sellingMethod,
    sellingUnit: item.sellingUnit ?? existing.sellingUnit,
    unitIncrement: item.unitIncrement ?? existing.unitIncrement,
    minSellQty: item.minSellQty ?? existing.minSellQty,
    maxSellQty: item.maxSellQty !== undefined ? item.maxSellQty : existing.maxSellQty,
  });
  return items.map((entry) => entry.productId === item.productId
    ? {
        ...entry,
        ...item,
        sellingMethod: mergedSettings.sellingMethod,
        sellingUnit: mergedSettings.sellingUnit,
        unitIncrement: mergedSettings.unitIncrement,
        minSellQty: mergedSettings.minSellQty,
        maxSellQty: mergedSettings.maxSellQty,
        quantity: snapQuantity(entry.quantity + item.quantity, mergedSettings),
      }
    : entry);
}
