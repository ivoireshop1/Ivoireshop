import { centsToUsdString } from "@/src/lib/payments/money";
import type { DeliveryOption } from "./types";

export type ShippingRateMode = "store_rate" | "manual_quote" | "live_api";

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

export function parseRateMode(value: unknown): ShippingRateMode {
  if (value === "manual_quote" || value === "live_api" || value === "store_rate") return value;
  return "store_rate";
}

export function rateModeLabel(mode: ShippingRateMode) {
  if (mode === "manual_quote") return "Manual Quote";
  if (mode === "live_api") return "Live Carrier API";
  return "Estimated / Store Rate";
}

export function checkoutShippingAmount(input: {
  baseCharge: number;
  handlingFee: number | null;
  freeShippingThreshold: number | null;
  subtotal: number;
}) {
  const waived = input.freeShippingThreshold != null && input.subtotal >= input.freeShippingThreshold;
  const shipping = waived ? 0 : input.baseCharge;
  return Number((shipping + (input.handlingFee ?? 0)).toFixed(2));
}

export function shippingMargin(collected: unknown, postage: unknown) {
  const charge = parseCharge(collected);
  const cost = parseCharge(postage);
  if (charge == null || cost == null) return null;
  return Number((charge - cost).toFixed(2));
}

export function manualCarrierOptions(
  settings: Record<string, unknown> | null | undefined,
  destinationCountry?: string | null,
  subtotal = 0,
): DeliveryOption[] {
  if (!destinationCountry?.trim()) return [];
  const international = !isDomesticCountry(destinationCountry);
  const options: DeliveryOption[] = [];
  const add = (carrier: "ups" | "usps") => {
    const enabled = Boolean(settings?.[`${carrier}_enabled`]);
    const show = settings?.[`${carrier}_show_at_checkout`] !== false;
    const mode = parseRateMode(settings?.[`${carrier}_rate_mode`]);
    if (!enabled || !show || mode === "live_api") return;
    const zoneEnabled = international
      ? Boolean(settings?.[`${carrier}_international_enabled`])
      : Boolean(settings?.[`${carrier}_domestic_enabled`]);
    if (!zoneEnabled) return;
    const base = parseCharge(international ? settings?.[`${carrier}_international_charge`] : settings?.[`${carrier}_domestic_charge`]);
    if (base == null) return;
    const amount = checkoutShippingAmount({
      baseCharge: base,
      handlingFee: parseCharge(settings?.[`${carrier}_handling_fee`]),
      freeShippingThreshold: parseCharge(settings?.[`${carrier}_free_shipping_threshold`]),
      subtotal,
    });
    options.push({
      id: `${carrier}:manual:${international ? "international" : "domestic"}`,
      provider: carrier,
      fulfillmentMethod: "delivery",
      label: carrier === "ups" ? "UPS Shipping" : "USPS Shipping",
      amount,
      serviceCode: international ? "manual-international" : "manual-domestic",
      estimate: mode === "manual_quote" ? "Ivoire Shop shipping charge" : "Estimated shipping",
      mode: "manual",
      zone: international ? "international" : "domestic",
      rateMode: mode,
    });
  };
  add("ups");
  add("usps");
  return options;
}

export function formatCharge(value: unknown) {
  const amount = parseCharge(value);
  return amount == null ? "Not set" : `$${centsToUsdString(Math.round(amount * 100))}`;
}
