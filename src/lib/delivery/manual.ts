import { centsToUsdString } from "@/src/lib/payments/money";
import type { DeliveryOption } from "./types";

export function isDomesticCountry(country?: string | null) {
  const value = (country ?? "").trim().toUpperCase();
  return value === "US" || value === "USA" || value === "UNITED STATES" || value === "UNITED STATES OF AMERICA";
}

export function parseCharge(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const number = Number(value);
  if (!Number.isFinite(number) || number < 0) return null;
  return Number(Number(number).toFixed(2));
}

export function manualCarrierOptions(settings: Record<string, unknown> | null | undefined, destinationCountry?: string | null): DeliveryOption[] {
  if (!destinationCountry?.trim()) return [];
  const international = !isDomesticCountry(destinationCountry);
  const options: DeliveryOption[] = [];
  const add = (
    enabledMaster: boolean,
    zoneEnabled: boolean,
    charge: unknown,
    provider: "ups" | "usps",
    zone: "domestic" | "international",
  ) => {
    if (!enabledMaster || !zoneEnabled) return;
    const amount = parseCharge(charge);
    if (amount == null) return;
    const label = provider === "ups" ? "UPS — Manual Shipping" : "USPS — Manual Shipping";
    options.push({
      id: `${provider}:manual:${zone}`,
      provider,
      fulfillmentMethod: "delivery",
      label,
      amount,
      serviceCode: zone === "international" ? "manual-international" : "manual-domestic",
      estimate: "Ivoire Shop shipping charge",
      mode: "manual",
      zone,
    });
  };
  add(
    Boolean(settings?.ups_enabled),
    international ? Boolean(settings?.ups_international_enabled) : Boolean(settings?.ups_domestic_enabled),
    international ? settings?.ups_international_charge : settings?.ups_domestic_charge,
    "ups",
    international ? "international" : "domestic",
  );
  add(
    Boolean(settings?.usps_enabled),
    international ? Boolean(settings?.usps_international_enabled) : Boolean(settings?.usps_domestic_enabled),
    international ? settings?.usps_international_charge : settings?.usps_domestic_charge,
    "usps",
    international ? "international" : "domestic",
  );
  return options;
}

export function formatCharge(value: unknown) {
  const amount = parseCharge(value);
  return amount == null ? "Not set" : `$${centsToUsdString(Math.round(amount * 100))}`;
}
