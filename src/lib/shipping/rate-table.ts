import type { DeliveryOption } from "../delivery/types.ts";

function isDomesticCountry(country?: string | null) {
  const value = (country ?? "").trim().toUpperCase();
  return value === "US" || value === "USA" || value === "UNITED STATES" || value === "UNITED STATES OF AMERICA";
}

export const RATE_TABLE_SERVICES = ["ground", "priority", "express"] as const;
export type RateTableService = (typeof RATE_TABLE_SERVICES)[number];
export const RATE_TABLE_BRACKETS_LB = [5, 10, 20, 25, 30, 40] as const;
export const RATE_TABLE_MAX_LB = 40;
export const DEFAULT_RATE_TABLE_BUFFER = 0.1;
export const RATE_TABLE_OVERWEIGHT_MESSAGE =
  "This cart is over 40 lb. Choose Store Pickup or contact the store. No store-calculated rate is invented.";

export type RateTableAmounts = Record<RateTableService, Record<string, number | null>>;

export type RateTableConfig = {
  enabled: boolean;
  buffer: number;
  amounts: RateTableAmounts;
};

export function emptyRateTableAmounts(): RateTableAmounts {
  return {
    ground: Object.fromEntries(RATE_TABLE_BRACKETS_LB.map((max) => [String(max), null])),
    priority: Object.fromEntries(RATE_TABLE_BRACKETS_LB.map((max) => [String(max), null])),
    express: Object.fromEntries(RATE_TABLE_BRACKETS_LB.map((max) => [String(max), null])),
  };
}

export function parseRateTableConfig(settings: Record<string, unknown> | null | undefined): RateTableConfig {
  const row = settings ?? {};
  const raw = row.rate_table && typeof row.rate_table === "object" ? row.rate_table as Record<string, unknown> : {};
  const amounts = emptyRateTableAmounts();
  for (const service of RATE_TABLE_SERVICES) {
    const block = raw[service] && typeof raw[service] === "object" ? raw[service] as Record<string, unknown> : {};
    for (const max of RATE_TABLE_BRACKETS_LB) {
      const value = Number(block[String(max)]);
      amounts[service][String(max)] = Number.isFinite(value) && value > 0 ? Number(value.toFixed(2)) : null;
    }
  }
  const bufferRaw = Number(row.rate_table_buffer ?? raw.buffer ?? DEFAULT_RATE_TABLE_BUFFER);
  const buffer = Number.isFinite(bufferRaw) && bufferRaw >= 0 && bufferRaw <= 1 ? bufferRaw : DEFAULT_RATE_TABLE_BUFFER;
  return {
    enabled: row.rate_table_enabled === true,
    buffer,
    amounts,
  };
}

export function rateTableIsComplete(config: RateTableConfig) {
  return RATE_TABLE_SERVICES.every((service) => (
    RATE_TABLE_BRACKETS_LB.every((max) => (config.amounts[service][String(max)] ?? 0) > 0)
  ));
}

export function rateTableCanOffer(config: RateTableConfig) {
  return config.enabled && rateTableIsComplete(config);
}

export function applyRateTableBuffer(amount: number, buffer: number) {
  return Number((amount * (1 + buffer)).toFixed(2));
}

export function lookupRateTableAmount(config: RateTableConfig, service: RateTableService, weightLb: number) {
  if (!(weightLb > 0)) return { ok: false as const, reason: "missing_weight" as const };
  if (weightLb > RATE_TABLE_MAX_LB) return { ok: false as const, reason: "overweight" as const };
  const max = RATE_TABLE_BRACKETS_LB.find((bracket) => weightLb <= bracket);
  if (!max) return { ok: false as const, reason: "overweight" as const };
  const base = config.amounts[service][String(max)];
  if (base == null || !(base > 0)) return { ok: false as const, reason: "unconfigured" as const };
  return { ok: true as const, amount: applyRateTableBuffer(base, config.buffer), bracketMaxLb: max, base };
}

export function rateTableServiceLabel(service: RateTableService) {
  if (service === "priority") return "Priority";
  if (service === "express") return "Express";
  return "Ground";
}

export function collectRateTableOptions(input: {
  settings?: Record<string, unknown> | null;
  destinationCountry?: string | null;
  weightLb: number;
  liveCarrierOptionsPresent: boolean;
}): { options: DeliveryOption[]; message?: string; usedFallback: boolean } {
  const config = parseRateTableConfig(input.settings);
  if (!rateTableCanOffer(config)) return { options: [], usedFallback: false };
  if (input.liveCarrierOptionsPresent) return { options: [], usedFallback: false };
  if (!isDomesticCountry(input.destinationCountry)) {
    return { options: [], usedFallback: false, message: "The store-calculated rate table is domestic US only. Store Pickup remains available." };
  }
  if (input.weightLb > RATE_TABLE_MAX_LB) {
    return { options: [], usedFallback: true, message: RATE_TABLE_OVERWEIGHT_MESSAGE };
  }
  const options: DeliveryOption[] = [];
  for (const service of RATE_TABLE_SERVICES) {
    const looked = lookupRateTableAmount(config, service, input.weightLb);
    if (!looked.ok) continue;
    const label = `STORE-CALCULATED · ${rateTableServiceLabel(service)}`;
    options.push({
      id: `rate-table:${service}`,
      provider: "store",
      fulfillmentMethod: "delivery",
      label,
      amount: looked.amount,
      serviceCode: service,
      serviceToken: service,
      estimate: `${looked.bracketMaxLb} lb bracket · ${Math.round(config.buffer * 100)}% buffer. Not a live UPS/USPS rate.`,
      mode: "manual",
      zone: "domestic",
      rateMode: "rate_table",
      usedFallback: true,
      billableWeightLb: Number(input.weightLb.toFixed(3)),
      quoteSource: "rate_table",
      currency: "USD",
    });
  }
  if (!options.length) {
    return { options: [], usedFallback: true, message: "Store-calculated rates are enabled but this weight bracket is not priced. Store Pickup remains available." };
  }
  return { options, usedFallback: true };
}
