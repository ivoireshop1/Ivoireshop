import { computeOrderTotalCents, computeTaxCents, moneyFromCents, safeUsdToCents, type TaxSettings } from "../tax/totals.ts";

export type QuoteCents = {
  subtotalCents: number;
  shippingCents: number;
  taxCents: number;
  totalCents: number;
  subtotal: number;
  shipping: number;
  tax: number;
  total: number;
};

export function quoteFromAuthoritativeParts(input: {
  unitPrices: Array<{ price: number | string | null | undefined; quantity: number }>;
  shippingAmount: number | string;
  tax: TaxSettings;
}): QuoteCents {
  const subtotalCents = input.unitPrices.reduce((sum, row) => sum + safeUsdToCents(row.price) * row.quantity, 0);
  const shippingCents = safeUsdToCents(input.shippingAmount);
  const taxCents = computeTaxCents({
    subtotalCents,
    discountCents: 0,
    shippingCents,
    tax: input.tax,
  });
  const totalCents = computeOrderTotalCents({
    subtotalCents,
    discountCents: 0,
    shippingCents,
    taxCents,
  });
  return {
    subtotalCents,
    shippingCents,
    taxCents,
    totalCents,
    subtotal: moneyFromCents(subtotalCents),
    shipping: moneyFromCents(shippingCents),
    tax: moneyFromCents(taxCents),
    total: moneyFromCents(totalCents),
  };
}

export function receiptTotalsMatch(order: { total?: number | string | null }, stripeAmountCents: number) {
  return safeUsdToCents(order.total) === stripeAmountCents;
}

export function clientQuotedTotalMatches(serverTotalCents: number, clientTotal: unknown) {
  if (clientTotal == null || clientTotal === "") return true;
  try {
    return safeUsdToCents(clientTotal) === serverTotalCents;
  } catch {
    return false;
  }
}

export function paymentStatusFromStripe(status: string | null | undefined) {
  if (status === "succeeded") return "paid" as const;
  if (status === "canceled") return "cancelled" as const;
  if (status === "requires_payment_method" || status === "requires_confirmation" || status === "requires_action" || status === "processing") {
    return "pending" as const;
  }
  return "failed" as const;
}

export function refundStatus(amountPaidCents: number, refundedCents: number) {
  if (refundedCents <= 0) return null;
  if (refundedCents >= amountPaidCents && amountPaidCents > 0) return "refunded" as const;
  return "partially_refunded" as const;
}

export function netPaidRevenue(order: { payment_status?: string | null; total?: number | string | null; refunded_amount?: number | string | null }) {
  if (order.payment_status !== "paid" && order.payment_status !== "partially_refunded") return 0;
  const netCents = Math.max(0, safeUsdToCents(order.total) - safeUsdToCents(order.refunded_amount));
  return moneyFromCents(netCents);
}

export function requiresStripePaymentBeforeFulfillment(order: { payment_provider?: string | null; payment_status?: string | null }) {
  return order.payment_provider === "stripe" && order.payment_status !== "paid" && order.payment_status !== "partially_refunded";
}
