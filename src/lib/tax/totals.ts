import { usdToCents, centsToUsdString } from "@/src/lib/payments/money";

export type TaxMode = "not_configured" | "no_tax" | "manual_rate";

export type TaxSettings = {
  tax_mode: TaxMode;
  tax_rate_percent: number | null;
  tax_applies_to_shipping: boolean;
  tax_name: string;
};

export function parseTaxMode(value: unknown): TaxMode {
  if (value === "no_tax" || value === "manual_rate" || value === "not_configured") return value;
  return "not_configured";
}

export function taxSettingsFromRow(row: Record<string, unknown> | null | undefined): TaxSettings {
  const rate = Number(row?.tax_rate_percent);
  return {
    tax_mode: parseTaxMode(row?.tax_mode),
    tax_rate_percent: Number.isFinite(rate) && rate >= 0 ? rate : null,
    tax_applies_to_shipping: Boolean(row?.tax_applies_to_shipping),
    tax_name: String(row?.tax_name ?? "Tax").trim() || "Tax",
  };
}

export function taxModeLabel(mode: TaxMode) {
  if (mode === "manual_rate") return "Configured / manual rate";
  if (mode === "no_tax") return "Configured / no tax collected";
  return "Not configured";
}

export function taxDisplayLabel(tax: TaxSettings) {
  if (tax.tax_mode === "manual_rate" && tax.tax_rate_percent != null && Number.isFinite(tax.tax_rate_percent)) {
    const rate = Number(tax.tax_rate_percent);
    const label = Number.isInteger(rate) ? String(rate) : String(rate);
    return `${tax.tax_name} (${label}%)`;
  }
  return tax.tax_name || "Tax";
}

export function computeTaxCents(input: {
  subtotalCents: number;
  discountCents: number;
  shippingCents: number;
  tax: TaxSettings;
}) {
  if (input.tax.tax_mode !== "manual_rate") return 0;
  const rate = input.tax.tax_rate_percent;
  if (rate == null || !Number.isFinite(rate) || rate < 0) return 0;
  const base = input.subtotalCents - input.discountCents + (input.tax.tax_applies_to_shipping ? input.shippingCents : 0);
  if (base <= 0) return 0;
  return Math.round((base * rate) / 100);
}

export function computeOrderTotalCents(input: {
  subtotalCents: number;
  discountCents: number;
  shippingCents: number;
  taxCents: number;
}) {
  return input.subtotalCents - input.discountCents + input.shippingCents + input.taxCents;
}

export function moneyFromCents(cents: number) {
  return Number(centsToUsdString(cents));
}

export function safeUsdToCents(value: unknown) {
  try {
    return usdToCents(typeof value === "number" || typeof value === "string" ? value : 0);
  } catch {
    return 0;
  }
}

export type OrderMoneyParts = {
  subtotal: number | string | null | undefined;
  discount_amount?: number | string | null;
  shipping_cost?: number | string | null;
  tax_amount?: number | string | null;
  total: number | string | null | undefined;
};

export function moneyParts(order: OrderMoneyParts) {
  return {
    subtotal: Number(order.subtotal ?? 0),
    discount: Number(order.discount_amount ?? 0),
    shipping: Number(order.shipping_cost ?? 0),
    tax: Number(order.tax_amount ?? 0),
    total: Number(order.total ?? 0),
  };
}
