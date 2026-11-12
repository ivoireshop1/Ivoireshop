import { usdToCents } from "../payments/money.ts";

export const CHECKOUT_PRODUCT_LOOKUP_ERROR =
  "We couldn't confirm the products in your cart. Refresh checkout before paying.";
export const CHECKOUT_PRODUCT_UNAVAILABLE =
  "A product in your cart is no longer available.";
export const CHECKOUT_PRICE_UNCONFIRMED =
  "A product price could not be confirmed. Refresh checkout before paying.";
export const CHECKOUT_QUANTITY_INVALID =
  "Check the quantity in your cart and try again.";
export const CHECKOUT_SHIPPING_UNCONFIRMED =
  "Shipping could not be confirmed. Choose pickup or refresh delivery options.";

export type MerchandiseLine = {
  price?: unknown;
  quantity: unknown;
};

export type MerchandiseSubtotal =
  | { ok: true; subtotalCents: number }
  | { ok: false; error: string };

/**
 * Merchandise only. Shipping is not included, and a missing or invalid price
 * is an error rather than a $0.00 line.
 */
export function merchandiseSubtotalCents(lines: MerchandiseLine[]): MerchandiseSubtotal {
  if (!lines.length) return { ok: true, subtotalCents: 0 };
  let subtotalCents = 0;
  for (const line of lines) {
    const quantity = typeof line.quantity === "number" ? line.quantity : Number(line.quantity);
    if (!Number.isFinite(quantity) || quantity <= 0) {
      return { ok: false, error: CHECKOUT_QUANTITY_INVALID };
    }
    if (line.price == null || line.price === "") {
      return { ok: false, error: CHECKOUT_PRICE_UNCONFIRMED };
    }
    let unitCents: number;
    try {
      unitCents = usdToCents(line.price as string | number);
    } catch {
      return { ok: false, error: CHECKOUT_PRICE_UNCONFIRMED };
    }
    if (unitCents <= 0) return { ok: false, error: CHECKOUT_PRICE_UNCONFIRMED };
    subtotalCents += Math.round(unitCents * quantity);
  }
  return { ok: true, subtotalCents };
}

/** Pickup may be $0. A missing shipping amount must not become free shipping. */
export function confirmedShippingCents(value: unknown): number | null {
  if (value == null || value === "") return null;
  try {
    return usdToCents(value as string | number);
  } catch {
    return null;
  }
}
