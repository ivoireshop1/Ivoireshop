import type { SellingMethod, SellingUnit } from "@/src/lib/catalog/selling";
import type { CheckoutReceipt, CheckoutRequest } from "./checkout-validation";
import { validateCheckout } from "./checkout-validation";

export const CHECKOUT_SESSION_KEY = "ivoire.checkout-attempt.v1";
export const CHECKOUT_DRAFT_KEY = "ivoire.checkout-draft.v1";

export type CheckoutStep = "account" | "shipping" | "payment" | "review";

export type CheckoutAttempt = {
  request: CheckoutRequest;
  items: {
    productId: string;
    name: string;
    quantity: number;
    price?: number;
    image?: string;
    sellingMethod?: SellingMethod;
    sellingUnit?: SellingUnit;
  }[];
  createdAt: number;
  receipt?: CheckoutReceipt;
  /** UI step for safe resume — never used for payment authorization. */
  step?: CheckoutStep;
};

/** Non-sensitive progress only. Never store card numbers, CVC, or Stripe client secrets. */
export type CheckoutDraft = {
  step: CheckoutStep;
  contact: { customerName: string; customerEmail: string; customerPhone: string };
  address: {
    addressLine1: string;
    addressLine2: string;
    city: string;
    state: string;
    postalCode: string;
    country: string;
  };
  fulfillmentMethod: "delivery" | "local_pickup";
  deliveryOptionId: string;
  quotedShipping?: number;
  updatedAt: number;
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
  // Never store card PAN/CVC or Stripe client_secret here.
  sessionStorage.setItem(CHECKOUT_SESSION_KEY, JSON.stringify(attempt));
}

export function forgetCheckoutAttempt() {
  sessionStorage.removeItem(CHECKOUT_SESSION_KEY);
}

export function readCheckoutDraft(): CheckoutDraft | null {
  try {
    const raw = sessionStorage.getItem(CHECKOUT_DRAFT_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as CheckoutDraft;
    if (!parsed || typeof parsed !== "object") return null;
    if (!["account", "shipping", "payment", "review"].includes(parsed.step)) return null;
    if (parsed.fulfillmentMethod !== "delivery" && parsed.fulfillmentMethod !== "local_pickup") return null;
    if (typeof parsed.updatedAt !== "number" || !Number.isFinite(parsed.updatedAt)) return null;
    // Drop drafts older than 24h — stale progress should not surprise the shopper.
    if (Date.now() - parsed.updatedAt > 24 * 60 * 60 * 1000) {
      sessionStorage.removeItem(CHECKOUT_DRAFT_KEY);
      return null;
    }
    return {
      step: parsed.step,
      contact: {
        customerName: String(parsed.contact?.customerName ?? ""),
        customerEmail: String(parsed.contact?.customerEmail ?? ""),
        customerPhone: String(parsed.contact?.customerPhone ?? ""),
      },
      address: {
        addressLine1: String(parsed.address?.addressLine1 ?? ""),
        addressLine2: String(parsed.address?.addressLine2 ?? ""),
        city: String(parsed.address?.city ?? ""),
        state: String(parsed.address?.state ?? ""),
        postalCode: String(parsed.address?.postalCode ?? ""),
        country: String(parsed.address?.country ?? "US") || "US",
      },
      fulfillmentMethod: parsed.fulfillmentMethod,
      deliveryOptionId: String(parsed.deliveryOptionId ?? ""),
      quotedShipping: typeof parsed.quotedShipping === "number" && Number.isFinite(parsed.quotedShipping)
        ? parsed.quotedShipping
        : undefined,
      updatedAt: parsed.updatedAt,
    };
  } catch {
    return null;
  }
}

export function storeCheckoutDraft(draft: Omit<CheckoutDraft, "updatedAt">) {
  const payload: CheckoutDraft = { ...draft, updatedAt: Date.now() };
  sessionStorage.setItem(CHECKOUT_DRAFT_KEY, JSON.stringify(payload));
}

export function forgetCheckoutDraft() {
  sessionStorage.removeItem(CHECKOUT_DRAFT_KEY);
}

export function forgetCheckoutProgress() {
  forgetCheckoutAttempt();
  forgetCheckoutDraft();
}
