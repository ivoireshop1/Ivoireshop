import { usdToCents, centsToUsdString } from "../payments/money.ts";

export type TaxMode = "not_configured" | "no_tax" | "manual_rate";

export type TaxRule = {
  key: "tax1" | "tax2";
  enabled: boolean;
  name: string;
  rate_percent: number | null;
  applies_to_shipping: boolean;
};

export type TaxLine = {
  key: TaxRule["key"];
  name: string;
  rate_percent: number;
  cents: number;
  amount: number;
};

export type TaxSettings = {
  tax_mode: TaxMode;
  tax_rate_percent: number | null;
  tax_applies_to_shipping: boolean;
  tax_name: string;
  rules?: TaxRule[];
};

function parseRate(value: unknown) {
  if (value == null || value === "") return null;
  const rate = Number(value);
  return Number.isFinite(rate) && rate >= 0 ? rate : null;
}

export function parseTaxMode(value: unknown): TaxMode {
  if (value === "no_tax" || value === "manual_rate" || value === "not_configured") return value;
  return "not_configured";
}

function ruleFromRow(
  row: Record<string, unknown>,
  key: TaxRule["key"],
  enabledKey: string,
  nameKey: string,
  rateKey: string,
  shippingKey: string,
  fallbackName: string,
  fallbackRate: number | null,
  fallbackShipping: boolean,
): TaxRule {
  const enabledRaw = row[enabledKey];
  return {
    key,
    enabled: Boolean(enabledRaw),
    name: String(row[nameKey] ?? fallbackName).trim() || fallbackName,
    rate_percent: parseRate(row[rateKey] ?? fallbackRate),
    applies_to_shipping: row[shippingKey] == null ? fallbackShipping : Boolean(row[shippingKey]),
  };
}

export function taxSettingsFromRow(row: Record<string, unknown> | null | undefined): TaxSettings {
  const legacyRate = parseRate(row?.tax_rate_percent);
  const legacyName = String(row?.tax_name ?? "Tax").trim() || "Tax";
  const legacyShipping = Boolean(row?.tax_applies_to_shipping);
  const legacyMode = parseTaxMode(row?.tax_mode);
  const hasDual = row != null && ("tax_1_enabled" in row || "tax_2_enabled" in row);

  if (!hasDual) {
    const enabled = legacyMode === "manual_rate" && legacyRate != null;
    return {
      tax_mode: legacyMode,
      tax_rate_percent: legacyRate,
      tax_applies_to_shipping: legacyShipping,
      tax_name: legacyName,
      rules: enabled
        ? [{ key: "tax1", enabled: true, name: legacyName, rate_percent: legacyRate, applies_to_shipping: legacyShipping }]
        : [],
    };
  }

  const tax1 = ruleFromRow(row, "tax1", "tax_1_enabled", "tax_1_name", "tax_1_rate_percent", "tax_1_applies_to_shipping", "Tax 1", legacyRate, legacyShipping);
  const tax2 = ruleFromRow(row, "tax2", "tax_2_enabled", "tax_2_name", "tax_2_rate_percent", "tax_2_applies_to_shipping", "Tax 2", null, legacyShipping);
  const enabled = [tax1, tax2].filter((rule) => rule.enabled && rule.rate_percent != null);
  const primary = enabled[0];
  // Respect explicit not_configured even when dual-tax columns exist as false/null.
  // Previously `tax_1_enabled == null` forced no_tax whenever the boolean was false.
  let tax_mode: TaxMode = "no_tax";
  if (enabled.length) tax_mode = "manual_rate";
  else if (legacyMode === "not_configured") tax_mode = "not_configured";
  return {
    tax_mode,
    tax_rate_percent: primary?.rate_percent ?? null,
    tax_applies_to_shipping: primary?.applies_to_shipping ?? false,
    tax_name: primary?.name ?? tax1.name,
    rules: [tax1, tax2],
  };
}

export function taxModeLabel(mode: TaxMode) {
  if (mode === "manual_rate") return "Configured / manual rate";
  if (mode === "no_tax") return "Configured / no tax collected";
  return "Not configured";
}

export function taxDisplayLabel(tax: TaxSettings) {
  const enabled = enabledTaxRules(tax);
  if (enabled.length === 1 && enabled[0].rate_percent != null) {
    return `${enabled[0].name} (${enabled[0].rate_percent}%)`;
  }
  if (enabled.length > 1) return enabled.map((rule) => rule.name).join(" + ");
  if (tax.tax_mode === "manual_rate" && tax.tax_rate_percent != null && Number.isFinite(tax.tax_rate_percent)) {
    return `${tax.tax_name} (${tax.tax_rate_percent}%)`;
  }
  return tax.tax_name || "Tax";
}

export function enabledTaxRules(tax: TaxSettings) {
  if (tax.rules?.length) return tax.rules.filter((rule) => rule.enabled && rule.rate_percent != null && rule.rate_percent >= 0);
  if (tax.tax_mode === "manual_rate" && tax.tax_rate_percent != null) {
    return [{ key: "tax1" as const, enabled: true, name: tax.tax_name, rate_percent: tax.tax_rate_percent, applies_to_shipping: tax.tax_applies_to_shipping }];
  }
  return [];
}

export function computeTaxLines(input: {
  subtotalCents: number;
  discountCents: number;
  shippingCents: number;
  tax: TaxSettings;
}): TaxLine[] {
  return enabledTaxRules(input.tax).map((rule) => {
    const rate = rule.rate_percent ?? 0;
    const base = input.subtotalCents - input.discountCents + (rule.applies_to_shipping ? input.shippingCents : 0);
    const cents = base > 0 ? Math.round((base * rate) / 100) : 0;
    return {
      key: rule.key,
      name: rate ? `${rule.name} (${rate}%)` : rule.name,
      rate_percent: rate,
      cents,
      amount: moneyFromCents(cents),
    };
  });
}

export function computeTaxCents(input: {
  subtotalCents: number;
  discountCents: number;
  shippingCents: number;
  tax: TaxSettings;
}) {
  return computeTaxLines(input).reduce((sum, line) => sum + line.cents, 0);
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

export function taxSnapshotFromSettings(tax: TaxSettings, amount: number, lines: TaxLine[]) {
  return {
    mode: tax.tax_mode,
    rate_percent: tax.tax_rate_percent,
    applies_to_shipping: tax.tax_applies_to_shipping,
    name: tax.tax_name,
    amount,
    rules: enabledTaxRules(tax).map((rule) => ({
      key: rule.key,
      name: rule.name,
      rate_percent: rule.rate_percent,
      applies_to_shipping: rule.applies_to_shipping,
    })),
    lines: lines.map((line) => ({ key: line.key, name: line.name, amount: line.amount })),
    decided_at: new Date().toISOString(),
  };
}
