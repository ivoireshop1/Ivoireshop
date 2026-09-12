import { CART_STORAGE_KEY } from "./cart-constants";
import { normalizeCart } from "./cart-utils";
import type { CartItem } from "@/src/types/cart";

export function loadCart(): CartItem[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(CART_STORAGE_KEY);
    return raw ? normalizeCart(JSON.parse(raw)) : [];
  } catch {
    return [];
  }
}

export function saveCart(items: CartItem[]) {
  if (typeof window === "undefined") return;
  try { window.localStorage.setItem(CART_STORAGE_KEY, JSON.stringify({ items })); } catch { /* storage is optional */ }
}

export function clearStoredCart() {
  if (typeof window === "undefined") return;
  try { window.localStorage.removeItem(CART_STORAGE_KEY); } catch { /* storage is optional */ }
}
