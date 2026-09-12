import type { CartItem } from "@/src/types/cart";

export function normalizeCart(items: unknown): CartItem[] {
  const value = Array.isArray(items) ? items : Array.isArray((items as { items?: unknown })?.items) ? (items as { items: unknown[] }).items : [];

  return value.filter(isCartItem).map((item) => ({ ...item, quantity: Math.max(1, Math.floor(item.quantity)) }));
}

function isCartItem(item: unknown): item is CartItem {
  if (!item || typeof item !== "object") return false;
  const value = item as Record<string, unknown>;
  return typeof value.productId === "string" && typeof value.slug === "string" && typeof value.name === "string" &&
    typeof value.price === "number" && Number.isFinite(value.price) && typeof value.image === "string" &&
    typeof value.quantity === "number" && Number.isFinite(value.quantity) && value.quantity > 0;
}

export function itemCount(items: CartItem[]) { return items.reduce((total, item) => total + item.quantity, 0); }
export function subtotal(items: CartItem[]) { return items.reduce((total, item) => total + item.price * item.quantity, 0); }
export function mergeItem(items: CartItem[], item: CartItem) {
  const existing = items.find((entry) => entry.productId === item.productId);
  return existing ? items.map((entry) => entry.productId === item.productId ? { ...entry, quantity: entry.quantity + item.quantity } : entry) : [...items, { ...item, quantity: Math.max(1, item.quantity) }];
}
