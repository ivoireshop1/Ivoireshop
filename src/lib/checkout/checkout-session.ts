import type { CheckoutReceipt, CheckoutRequest } from "./checkout-validation";
import { validateCheckout } from "./checkout-validation";

export const CHECKOUT_SESSION_KEY = "ivoire.checkout-attempt.v1";
export type CheckoutAttempt = {
  request: CheckoutRequest;
  items: { productId: string; name: string; quantity: number }[];
  createdAt: number;
  receipt?: CheckoutReceipt;
};

export function readCheckoutAttempt(): CheckoutAttempt | null {
  try {
    const raw = sessionStorage.getItem(CHECKOUT_SESSION_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as CheckoutAttempt;
    if (validateCheckout(parsed.request).error || !Array.isArray(parsed.items)) return null;
    if (parsed.receipt && (!parsed.receipt.order_id || !parsed.receipt.order_number || !Number.isFinite(parsed.receipt.total))) return null;
    return parsed;
  } catch { return null; }
}

export function storeCheckoutAttempt(attempt: CheckoutAttempt) {
  // Fail before submission if recovery cannot survive a reload.
  sessionStorage.setItem(CHECKOUT_SESSION_KEY, JSON.stringify(attempt));
}

export function forgetCheckoutAttempt() {
  sessionStorage.removeItem(CHECKOUT_SESSION_KEY);
}
