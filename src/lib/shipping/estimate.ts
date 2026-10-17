function isDomesticCountry(country?: string | null) {
  const value = (country ?? "").trim().toUpperCase();
  return value === "US" || value === "USA" || value === "UNITED STATES" || value === "UNITED STATES OF AMERICA";
}

function parseCharge(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const number = Number(value);
  if (!Number.isFinite(number) || number < 0) return null;
  return Number(number.toFixed(2));
}

export const STORE_SHIPPING_DISCLAIMER =
  "Store-calculated shipping charge. This is not a live UPS or USPS quote.";

export type ShippingPackage = {
  quantity: number;
  ship_weight_lb?: number | string | null;
  ship_length_in?: number | string | null;
  ship_width_in?: number | string | null;
  ship_height_in?: number | string | null;
};

export type ShippingZoneRule = {
  id: string;
  name: string;
  match: "domestic" | "international";
  base_rate: number;
  per_lb: number;
  surcharge: number;
  min_weight_lb: number;
  max_weight_lb: number | null;
  is_active: boolean;
};

export type IvoireShippingConfig = {
  enabled: boolean;
  markup_percent: number;
  fallback_amount: number | null;
  max_weight_lb: number | null;
  dim_divisor: number;
  zones: ShippingZoneRule[];
};

export const DEFAULT_IVOIRE_SHIPPING_CONFIG: IvoireShippingConfig = {
  enabled: true,
  markup_percent: 0,
  fallback_amount: 12.5,
  max_weight_lb: 150,
  dim_divisor: 166,
  zones: [
    {
      id: "domestic",
      name: "United States",
      match: "domestic",
      base_rate: 8.5,
      per_lb: 0.85,
      surcharge: 0,
      min_weight_lb: 0,
      max_weight_lb: 70,
      is_active: true,
    },
    {
      id: "international",
      name: "International",
      match: "international",
      base_rate: 24,
      per_lb: 1.75,
      surcharge: 4,
      min_weight_lb: 0,
      max_weight_lb: 70,
      is_active: true,
    },
  ],
};

function num(value: unknown, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
}

export function billableWeightLb(packages: ShippingPackage[], dimDivisor: number) {
  const divisor = dimDivisor > 0 ? dimDivisor : 166;
  return packages.reduce((sum, item) => {
    const qty = Math.max(1, Math.round(num(item.quantity, 1)));
    const actual = num(item.ship_weight_lb);
    const length = num(item.ship_length_in);
    const width = num(item.ship_width_in);
    const height = num(item.ship_height_in);
    const dim = length && width && height ? (length * width * height) / divisor : 0;
    const billable = Math.max(actual, dim, actual ? 0 : 1);
    return sum + billable * qty;
  }, 0);
}

export function ivoireShippingConfigFromRow(row: Record<string, unknown> | null | undefined): IvoireShippingConfig {
  const raw = row?.ivoire_shipping_config;
  const parsed = raw && typeof raw === "object" && !Array.isArray(raw) ? (raw as Record<string, unknown>) : {};
  const zones = Array.isArray(parsed.zones) ? parsed.zones : DEFAULT_IVOIRE_SHIPPING_CONFIG.zones;
  return {
    enabled: row?.ivoire_shipping_enabled !== false,
    markup_percent: num(row?.ivoire_shipping_markup_percent ?? parsed.markup_percent, 0),
    fallback_amount: parseCharge(row?.ivoire_shipping_fallback_amount ?? parsed.fallback_amount) ?? DEFAULT_IVOIRE_SHIPPING_CONFIG.fallback_amount,
    max_weight_lb: (() => {
      const value = row?.ivoire_shipping_max_weight_lb ?? parsed.max_weight_lb;
      if (value == null || value === "") return DEFAULT_IVOIRE_SHIPPING_CONFIG.max_weight_lb;
      const parsedWeight = Number(value);
      return Number.isFinite(parsedWeight) && parsedWeight > 0 ? parsedWeight : DEFAULT_IVOIRE_SHIPPING_CONFIG.max_weight_lb;
    })(),
    dim_divisor: num(parsed.dim_divisor, DEFAULT_IVOIRE_SHIPPING_CONFIG.dim_divisor) || 166,
    zones: zones
      .map((zone, index) => {
        const item = zone && typeof zone === "object" ? (zone as Record<string, unknown>) : {};
        return {
          id: String(item.id ?? `zone-${index}`),
          name: String(item.name ?? "Zone"),
          match: item.match === "international" ? "international" : "domestic",
          base_rate: num(item.base_rate),
          per_lb: num(item.per_lb),
          surcharge: num(item.surcharge),
          min_weight_lb: num(item.min_weight_lb),
          max_weight_lb: item.max_weight_lb == null || item.max_weight_lb === "" ? null : num(item.max_weight_lb),
          is_active: item.is_active !== false,
        } satisfies ShippingZoneRule;
      })
      .filter((zone) => zone.is_active),
  };
}

export type IvoireEstimate = {
  amount: number;
  usedFallback: boolean;
  zoneId: string | null;
  zoneName: string | null;
  billableWeightLb: number;
  explanation: string;
  source: "ivoire_engine";
};

export function explainIvoireShippingEstimate(input: {
  zoneName: string | null;
  billableWeightLb: number;
  base: number;
  perLb: number;
  surcharge: number;
  markupPercent: number;
  amount: number;
  usedFallback: boolean;
}) {
  if (input.usedFallback) {
    return `Fallback store shipping charge applied. ${STORE_SHIPPING_DISCLAIMER}`;
  }
  const zone = input.zoneName || "selected zone";
  return `Calculated from package weight/size and the ${zone} rate rule (base $${input.base.toFixed(2)} + $${input.perLb.toFixed(2)}/lb + surcharge $${input.surcharge.toFixed(2)}${input.markupPercent ? `, markup ${input.markupPercent}%` : ""}). ${STORE_SHIPPING_DISCLAIMER}`;
}

export function estimateIvoireShipping(input: {
  config: IvoireShippingConfig;
  packages: ShippingPackage[];
  destinationCountry?: string | null;
}): IvoireEstimate | null {
  if (!input.config.enabled) return null;
  const international = !isDomesticCountry(input.destinationCountry);
  const match = international ? "international" : "domestic";
  const zone = input.config.zones.find((item) => item.match === match) ?? input.config.zones[0] ?? null;
  const weight = Number(billableWeightLb(input.packages, input.config.dim_divisor).toFixed(2));
  const overMax = input.config.max_weight_lb != null && weight > input.config.max_weight_lb;
  const zoneOver = zone?.max_weight_lb != null && weight > zone.max_weight_lb;
  const underMin = zone != null && weight < zone.min_weight_lb;
  if (!zone || overMax || zoneOver || underMin) {
    const amount = input.config.fallback_amount ?? 0;
    return {
      amount,
      usedFallback: true,
      zoneId: zone?.id ?? null,
      zoneName: zone?.name ?? null,
      billableWeightLb: weight,
      explanation: explainIvoireShippingEstimate({
        zoneName: zone?.name ?? null,
        billableWeightLb: weight,
        base: 0,
        perLb: 0,
        surcharge: 0,
        markupPercent: input.config.markup_percent,
        amount,
        usedFallback: true,
      }),
      source: "ivoire_engine",
    };
  }
  const raw = zone.base_rate + zone.per_lb * weight + zone.surcharge;
  const marked = raw * (1 + input.config.markup_percent / 100);
  const amount = Number(Math.max(0, marked).toFixed(2));
  return {
    amount,
    usedFallback: false,
    zoneId: zone.id,
    zoneName: zone.name,
    billableWeightLb: weight,
    explanation: explainIvoireShippingEstimate({
      zoneName: zone.name,
      billableWeightLb: weight,
      base: zone.base_rate,
      perLb: zone.per_lb,
      surcharge: zone.surcharge,
      markupPercent: input.config.markup_percent,
      amount,
      usedFallback: false,
    }),
    source: "ivoire_engine",
  };
}
