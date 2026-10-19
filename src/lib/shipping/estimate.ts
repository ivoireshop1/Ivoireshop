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

export const IVOIRE_SHIPPING_ENGINE = "rules" as const;

export type ShippingPackage = {
  quantity: number;
  ship_weight_lb?: number | string | null;
  ship_length_in?: number | string | null;
  ship_width_in?: number | string | null;
  ship_height_in?: number | string | null;
  /** When true, never invent weight/dimensions from admin package defaults. */
  forbidPackageDefaults?: boolean;
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
  zip_prefixes: string[];
  is_active: boolean;
};

export type MissingInfoPolicy = "fallback" | "block";

export type PackageDefaults = {
  weight_lb: number | null;
  length_in: number | null;
  width_in: number | null;
  height_in: number | null;
};

export type IvoireShippingConfig = {
  enabled: boolean;
  markup_percent: number;
  handling_fee: number;
  min_charge: number | null;
  max_charge: number | null;
  fallback_amount: number | null;
  max_weight_lb: number | null;
  dim_divisor: number;
  require_us_zip: boolean;
  missing_info_policy: MissingInfoPolicy;
  invalid_zip_policy: MissingInfoPolicy;
  package_defaults: PackageDefaults;
  zones: ShippingZoneRule[];
};

export const DEFAULT_IVOIRE_SHIPPING_CONFIG: IvoireShippingConfig = {
  enabled: true,
  markup_percent: 0,
  handling_fee: 0,
  min_charge: null,
  max_charge: null,
  fallback_amount: 12.5,
  max_weight_lb: 150,
  dim_divisor: 166,
  require_us_zip: true,
  missing_info_policy: "fallback",
  invalid_zip_policy: "block",
  package_defaults: {
    weight_lb: 1,
    length_in: 10,
    width_in: 8,
    height_in: 6,
  },
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
      zip_prefixes: [],
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
      zip_prefixes: [],
      is_active: true,
    },
  ],
};

function num(value: unknown, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
}

function optionalPositive(value: unknown): number | null {
  if (value == null || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
}

export function parseUsZip(value?: string | null): { ok: true; zip5: string } | { ok: false } {
  const digits = (value ?? "").replace(/\D/g, "");
  if (digits.length === 5 || digits.length === 9) return { ok: true, zip5: digits.slice(0, 5) };
  return { ok: false };
}

function parseZipPrefixes(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.map((item) => String(item).replace(/\D/g, "")).filter((item) => item.length >= 2);
  }
  if (typeof value === "string") {
    return value
      .split(/[,\s]+/)
      .map((item) => item.replace(/\D/g, ""))
      .filter((item) => item.length >= 2);
  }
  return [];
}

function parsePolicy(value: unknown, fallback: MissingInfoPolicy): MissingInfoPolicy {
  return value === "block" || value === "fallback" ? value : fallback;
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
    const billable = Math.max(actual, dim);
    return sum + billable * qty;
  }, 0);
}

function applyPackageDefaults(packages: ShippingPackage[], defaults: PackageDefaults) {
  let usedDefaults = false;
  const next = packages.map((item) => {
    const qty = Math.max(1, Math.round(num(item.quantity, 1)));
    const strict = item.forbidPackageDefaults === true;
    const weight = num(item.ship_weight_lb) || (!strict ? defaults.weight_lb : 0) || 0;
    const length = num(item.ship_length_in) || (!strict ? defaults.length_in : 0) || 0;
    const width = num(item.ship_width_in) || (!strict ? defaults.width_in : 0) || 0;
    const height = num(item.ship_height_in) || (!strict ? defaults.height_in : 0) || 0;
    if (!strict && !num(item.ship_weight_lb) && defaults.weight_lb) usedDefaults = true;
    if (!strict && (!num(item.ship_length_in) || !num(item.ship_width_in) || !num(item.ship_height_in)) && (defaults.length_in || defaults.width_in || defaults.height_in)) {
      usedDefaults = true;
    }
    return {
      quantity: qty,
      ship_weight_lb: weight || null,
      ship_length_in: length || null,
      ship_width_in: width || null,
      ship_height_in: height || null,
    };
  });
  const missingWeight = next.some((item) => !num(item.ship_weight_lb));
  return { packages: next, usedDefaults, missingWeight };
}

export function ivoireShippingConfigFromRow(row: Record<string, unknown> | null | undefined): IvoireShippingConfig {
  const raw = row?.ivoire_shipping_config;
  const parsed = raw && typeof raw === "object" && !Array.isArray(raw) ? (raw as Record<string, unknown>) : {};
  const defaultsRaw = parsed.package_defaults && typeof parsed.package_defaults === "object" && !Array.isArray(parsed.package_defaults)
    ? (parsed.package_defaults as Record<string, unknown>)
    : {};
  const zones = Array.isArray(parsed.zones) ? parsed.zones : DEFAULT_IVOIRE_SHIPPING_CONFIG.zones;
  return {
    enabled: row?.ivoire_shipping_enabled !== false,
    markup_percent: num(row?.ivoire_shipping_markup_percent ?? parsed.markup_percent, 0),
    handling_fee: parseCharge(parsed.handling_fee) ?? 0,
    min_charge: parseCharge(parsed.min_charge),
    max_charge: parseCharge(parsed.max_charge),
    fallback_amount: parseCharge(row?.ivoire_shipping_fallback_amount ?? parsed.fallback_amount) ?? DEFAULT_IVOIRE_SHIPPING_CONFIG.fallback_amount,
    max_weight_lb: (() => {
      const value = row?.ivoire_shipping_max_weight_lb ?? parsed.max_weight_lb;
      if (value == null || value === "") return DEFAULT_IVOIRE_SHIPPING_CONFIG.max_weight_lb;
      const parsedWeight = Number(value);
      return Number.isFinite(parsedWeight) && parsedWeight > 0 ? parsedWeight : DEFAULT_IVOIRE_SHIPPING_CONFIG.max_weight_lb;
    })(),
    dim_divisor: num(parsed.dim_divisor, DEFAULT_IVOIRE_SHIPPING_CONFIG.dim_divisor) || 166,
    require_us_zip: parsed.require_us_zip !== false,
    missing_info_policy: parsePolicy(parsed.missing_info_policy, "fallback"),
    invalid_zip_policy: parsePolicy(parsed.invalid_zip_policy, "block"),
    package_defaults: {
      weight_lb: optionalPositive(defaultsRaw.weight_lb) ?? DEFAULT_IVOIRE_SHIPPING_CONFIG.package_defaults.weight_lb,
      length_in: optionalPositive(defaultsRaw.length_in) ?? DEFAULT_IVOIRE_SHIPPING_CONFIG.package_defaults.length_in,
      width_in: optionalPositive(defaultsRaw.width_in) ?? DEFAULT_IVOIRE_SHIPPING_CONFIG.package_defaults.width_in,
      height_in: optionalPositive(defaultsRaw.height_in) ?? DEFAULT_IVOIRE_SHIPPING_CONFIG.package_defaults.height_in,
    },
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
          zip_prefixes: parseZipPrefixes(item.zip_prefixes),
          is_active: item.is_active !== false,
        } satisfies ShippingZoneRule;
      }),
  };
}

export function ivoireShippingConfigIssues(config: IvoireShippingConfig, originComplete: boolean) {
  const issues: string[] = [];
  const active = config.zones.filter((zone) => zone.is_active);
  if (!config.enabled) issues.push("Ivoire Shop shipping is disabled at checkout.");
  if (!active.length) issues.push("No active shipping zones. Customers will not see Ivoire Shop shipping.");
  if (!active.some((zone) => zone.match === "domestic")) issues.push("Domestic US zone is off.");
  if (!active.some((zone) => zone.match === "international")) issues.push("International zone is off.");
  if ((config.missing_info_policy === "fallback" || config.invalid_zip_policy === "fallback") && config.fallback_amount == null) {
    issues.push("Fallback policy is selected, but no fallback amount is configured.");
  }
  if (config.min_charge != null && config.max_charge != null && config.min_charge > config.max_charge) {
    issues.push("Minimum charge is higher than maximum charge.");
  }
  if (!originComplete) issues.push("Store pickup origin is incomplete. Estimates still calculate from destination country/ZIP; origin should be completed for order snapshots.");
  return issues;
}

export type IvoireEstimate = {
  amount: number;
  usedFallback: boolean;
  usedDefaults: boolean;
  blocked?: boolean;
  blockReason?: string;
  zoneId: string | null;
  zoneName: string | null;
  billableWeightLb: number;
  explanation: string;
  source: "ivoire_engine";
  details: {
    origin?: string | null;
    destinationCountry?: string | null;
    destinationZip?: string | null;
    base: number;
    perLb: number;
    surcharge: number;
    markupPercent: number;
    handlingFee: number;
  };
};

function finishAmount(raw: number, config: IvoireShippingConfig) {
  const marked = raw * (1 + config.markup_percent / 100) + config.handling_fee;
  let amount = Math.max(0, marked);
  if (config.min_charge != null) amount = Math.max(amount, config.min_charge);
  if (config.max_charge != null) amount = Math.min(amount, config.max_charge);
  return Number(amount.toFixed(2));
}

export function explainIvoireShippingEstimate(input: {
  zoneName: string | null;
  billableWeightLb: number;
  base: number;
  perLb: number;
  surcharge: number;
  markupPercent: number;
  handlingFee: number;
  amount: number;
  usedFallback: boolean;
  usedDefaults: boolean;
  blocked?: boolean;
  blockReason?: string;
  origin?: string | null;
  destinationZip?: string | null;
}) {
  if (input.blocked) {
    return input.blockReason || "Ivoire Shop shipping cannot be quoted for this destination yet.";
  }
  const originBit = input.origin ? ` From ${input.origin}.` : "";
  const zipBit = input.destinationZip ? ` Destination ZIP ${input.destinationZip}.` : "";
  const defaultBit = input.usedDefaults ? " Missing product weight/size used admin package defaults." : "";
  if (input.usedFallback) {
    return `Fallback store shipping charge applied ($${input.amount.toFixed(2)}).${defaultBit}${originBit}${zipBit} ${STORE_SHIPPING_DISCLAIMER}`;
  }
  const zone = input.zoneName || "selected zone";
  const handling = input.handlingFee ? `, handling $${input.handlingFee.toFixed(2)}` : "";
  return `Calculated from package weight/size and the ${zone} rate rule (base $${input.base.toFixed(2)} + $${input.perLb.toFixed(2)}/lb + surcharge $${input.surcharge.toFixed(2)}${input.markupPercent ? `, markup ${input.markupPercent}%` : ""}${handling}).${defaultBit}${originBit}${zipBit} ${STORE_SHIPPING_DISCLAIMER}`;
}

function fallbackOrBlock(
  config: IvoireShippingConfig,
  policy: MissingInfoPolicy,
  reason: string,
  extras: {
    zone: ShippingZoneRule | null;
    weight: number;
    usedDefaults: boolean;
    origin?: string | null;
    destinationCountry?: string | null;
    destinationZip?: string | null;
  },
): IvoireEstimate | null {
  if (policy === "block" || config.fallback_amount == null) {
    return {
      amount: 0,
      usedFallback: false,
      usedDefaults: extras.usedDefaults,
      blocked: true,
      blockReason: reason,
      zoneId: extras.zone?.id ?? null,
      zoneName: extras.zone?.name ?? null,
      billableWeightLb: extras.weight,
      explanation: reason,
      source: "ivoire_engine",
      details: {
        origin: extras.origin,
        destinationCountry: extras.destinationCountry,
        destinationZip: extras.destinationZip,
        base: 0,
        perLb: 0,
        surcharge: 0,
        markupPercent: config.markup_percent,
        handlingFee: config.handling_fee,
      },
    };
  }
  const amount = Number(config.fallback_amount.toFixed(2));
  return {
    amount,
    usedFallback: true,
    usedDefaults: extras.usedDefaults,
    zoneId: extras.zone?.id ?? null,
    zoneName: extras.zone?.name ?? null,
    billableWeightLb: extras.weight,
    explanation: explainIvoireShippingEstimate({
      zoneName: extras.zone?.name ?? null,
      billableWeightLb: extras.weight,
      base: 0,
      perLb: 0,
      surcharge: 0,
      markupPercent: config.markup_percent,
      handlingFee: 0,
      amount,
      usedFallback: true,
      usedDefaults: extras.usedDefaults,
      origin: extras.origin,
      destinationZip: extras.destinationZip,
    }),
    source: "ivoire_engine",
    details: {
      origin: extras.origin,
      destinationCountry: extras.destinationCountry,
      destinationZip: extras.destinationZip,
      base: 0,
      perLb: 0,
      surcharge: 0,
      markupPercent: config.markup_percent,
      handlingFee: 0,
    },
  };
}

function matchZone(config: IvoireShippingConfig, match: "domestic" | "international", zip5: string | null) {
  const candidates = config.zones.filter((zone) => zone.is_active && zone.match === match);
  if (zip5) {
    const prefixed = candidates.find((zone) => zone.zip_prefixes.some((prefix) => zip5.startsWith(prefix)));
    if (prefixed) return prefixed;
  }
  return candidates.find((zone) => zone.zip_prefixes.length === 0) ?? candidates[0] ?? null;
}

export function estimateIvoireShipping(input: {
  config: IvoireShippingConfig;
  packages: ShippingPackage[];
  destinationCountry?: string | null;
  destinationPostalCode?: string | null;
  originLabel?: string | null;
}): IvoireEstimate | null {
  if (!input.config.enabled) return null;
  if (!input.packages.length) return null;
  const international = !isDomesticCountry(input.destinationCountry);
  const match = international ? "international" : "domestic";
  const prepared = applyPackageDefaults(input.packages, input.config.package_defaults);
  const weight = Number(billableWeightLb(prepared.packages, input.config.dim_divisor).toFixed(2));
  const zip = parseUsZip(input.destinationPostalCode);
  const zip5 = zip.ok ? zip.zip5 : null;
  const extras = {
    zone: matchZone(input.config, match, zip5) as ShippingZoneRule | null,
    weight,
    usedDefaults: prepared.usedDefaults,
    origin: input.originLabel ?? null,
    destinationCountry: input.destinationCountry ?? null,
    destinationZip: zip5,
  };

  if (!international && input.config.require_us_zip && !zip.ok) {
    return fallbackOrBlock(
      input.config,
      input.config.invalid_zip_policy,
      "Enter a valid U.S. ZIP code to calculate Ivoire Shop shipping.",
      extras,
    );
  }

  if (prepared.missingWeight) {
    const strictWeight = input.packages.some((item) => item.forbidPackageDefaults);
    return fallbackOrBlock(
      input.config,
      strictWeight ? "block" : input.config.missing_info_policy,
      strictWeight
        ? "Package weight or dimensions are missing for a weight-based product. Configure shipping dimensions in admin; purchased weight is used as product weight and defaults are never invented."
        : "Package weight is missing. Add product shipping weight or package defaults, or set a fallback charge.",
      extras,
    );
  }

  const zone = extras.zone;
  const overMax = input.config.max_weight_lb != null && weight > input.config.max_weight_lb;
  const zoneOver = zone?.max_weight_lb != null && weight > zone.max_weight_lb;
  const underMin = zone != null && weight < zone.min_weight_lb;
  if (!zone || overMax || zoneOver || underMin) {
    return fallbackOrBlock(
      input.config,
      "fallback",
      !zone
        ? "No matching Ivoire shipping zone is active for this destination."
        : "This shipment is outside the configured weight range for the selected zone.",
      { ...extras, zone },
    );
  }

  const raw = zone.base_rate + zone.per_lb * weight + zone.surcharge;
  const amount = finishAmount(raw, input.config);
  return {
    amount,
    usedFallback: false,
    usedDefaults: prepared.usedDefaults,
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
      handlingFee: input.config.handling_fee,
      amount,
      usedFallback: false,
      usedDefaults: prepared.usedDefaults,
      origin: input.originLabel,
      destinationZip: zip5,
    }),
    source: "ivoire_engine",
    details: {
      origin: input.originLabel ?? null,
      destinationCountry: input.destinationCountry ?? null,
      destinationZip: zip5,
      base: zone.base_rate,
      perLb: zone.per_lb,
      surcharge: zone.surcharge,
      markupPercent: input.config.markup_percent,
      handlingFee: input.config.handling_fee,
    },
  };
}
