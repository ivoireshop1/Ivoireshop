import { CART_STORAGE_KEY } from "./cart-constants";
import { normalizeCart, subtractPurchasedItems } from "./cart-utils";
import type { CartItem } from "@/src/types/cart";

export function loadCart(): CartItem[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(CART_STORAGE_KEY);
    if (!raw) return [];

    const parsed = JSON.parse(raw);
    return normalizeCart(parsed);
  } catch {
    return [];
  }
}

function readStoredValue() {
  try { return JSON.parse(window.localStorage.getItem(CART_STORAGE_KEY) ?? "null"); }
  catch { return null; }
}

export function saveCart(items: CartItem[]) {
  if (typeof window === "undefined") return;
  try {
    const previous = readStoredValue();
    window.localStorage.setItem(CART_STORAGE_KEY, JSON.stringify({ items, completedOrders: previous?.completedOrders ?? [] }));
  } catch {
    /* storage is optional */
  }
}

export function completeStoredPurchase(items: CartItem[], purchased: { productId: string; quantity: number }[], orderId: string): CartItem[] {
  const previous = readStoredValue();
  const completedOrders: string[] = Array.isArray(previous?.completedOrders) ? previous.completedOrders : [];
  if (completedOrders.includes(orderId)) return normalizeCart(previous);
  const remaining = subtractPurchasedItems(items, purchased);
  // Cart contents and the receipt marker are persisted in one write so recovery is idempotent.
  window.localStorage.setItem(CART_STORAGE_KEY, JSON.stringify({ items: remaining, completedOrders: [...completedOrders, orderId].slice(-100) }));
  return remaining;
}

export function clearStoredCart() {
  if (typeof window === "undefined") return;
  try { window.localStorage.removeItem(CART_STORAGE_KEY); } catch { /* storage is optional */ }
}
