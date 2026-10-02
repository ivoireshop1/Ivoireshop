import { createClient } from "@/src/lib/supabase/server";
import { STORE_SETTINGS_ID } from "@/src/lib/store/constants";
import { originFromSettings, originIsComplete, type PickupLocationSnapshot } from "./origin";
import { quoteDoorDash } from "./providers/doordash";
import { sanitizeProviderError, type DeliveryOption } from "./types";
import { parseCharge, manualCarrierOptions } from "./manual";
import { taxSettingsFromRow, computeTaxCents, computeOrderTotalCents, moneyFromCents, safeUsdToCents } from "@/src/lib/tax/totals";

function logDelivery(provider: string, operation: string, success: boolean, message?: string) {
  console.info("[delivery]", {
    provider,
    operation,
    success,
    timestamp: new Date().toISOString(),
    message: message ? sanitizeProviderError(message) : undefined,
  });
}

export async function collectCheckoutOptions(input: {
  destination: { address_line_1?: string; city?: string; state?: string; postal_code?: string; country?: string };
  products: Array<{
    quantity: number;
    price?: number | string | null;
    ship_weight_lb?: number | string | null;
    ship_length_in?: number | string | null;
    ship_width_in?: number | string | null;
    ship_height_in?: number | string | null;
  }>;
}) {
  const supabase = await createClient();
  const { data: settings } = await supabase.from("store_settings").select("*").eq("id", STORE_SETTINGS_ID).maybeSingle();
  const origin = originFromSettings(settings);
  const options: DeliveryOption[] = [];
  if (settings?.pickup_enabled !== false && settings?.pickup_show_at_checkout !== false) {
    options.push({
      id: "pickup",
      provider: "pickup",
      fulfillmentMethod: "local_pickup",
      label: "Pickup · Store Pickup",
      amount: 0,
    });
  }
  if (settings?.store_delivery_enabled !== false && settings?.store_delivery_show_at_checkout !== false) {
    options.push({
      id: "store",
      provider: "store",
      fulfillmentMethod: "delivery",
      label: "Delivery · Arranged by Ivoire Shop",
      amount: parseCharge(settings?.store_delivery_charge) ?? 0,
    });
  }

  const tax = taxSettingsFromRow(settings);
  const subtotalCents = input.products.reduce((sum, product) => sum + safeUsdToCents(product.price) * product.quantity, 0);
  const destReady = Boolean(input.destination.address_line_1 && input.destination.city && input.destination.country);
  if (destReady && originIsComplete(origin) && settings?.doordash_enabled) {
    const quoted = await quoteDoorDash({ origin, destination: input.destination });
    logDelivery("doordash", "quote", !quoted.error, quoted.error);
    options.push(...quoted.options.map((option) => ({ ...option, mode: "api" as const })));
  }
  const quoteCountry = input.destination.country?.trim() || origin.country?.trim() || "US";
  options.push(...manualCarrierOptions(settings, quoteCountry, moneyFromCents(subtotalCents)));

  const breakdowns: Record<string, { shipping: number; tax: number; total: number }> = {};
  for (const option of options) {
    const shippingCents = safeUsdToCents(option.amount);
    const taxCents = computeTaxCents({
      subtotalCents,
      discountCents: 0,
      shippingCents,
      tax,
    });
    breakdowns[option.id] = {
      shipping: moneyFromCents(shippingCents),
      tax: moneyFromCents(taxCents),
      total: moneyFromCents(computeOrderTotalCents({ subtotalCents, discountCents: 0, shippingCents, taxCents })),
    };
  }

  if (!options.length) {
    return {
      options,
      breakdowns,
      subtotal: moneyFromCents(subtotalCents),
      tax,
      origin: originIsComplete(origin) ? origin : null,
      message: "No delivery methods are available right now. Please try pickup later or contact the store.",
    };
  }
  return {
    options,
    breakdowns,
    subtotal: moneyFromCents(subtotalCents),
    tax,
    origin: originIsComplete(origin) ? origin : null,
    message: options.length
      ? undefined
      : "No delivery methods are available right now. Please try pickup later or contact the store.",
  };
}

export function optionToSnapshot(option: DeliveryOption, pickupLocation?: PickupLocationSnapshot | null) {
  return {
    provider: option.provider,
    service: option.serviceCode || option.label,
    amount: option.amount,
    estimate: option.estimate || null,
    mode: option.mode || (option.provider === "ups" || option.provider === "usps" ? "manual" : null),
    zone: option.zone || null,
    quoted_at: new Date().toISOString(),
    ...(option.provider === "pickup" && pickupLocation ? { pickup_location: pickupLocation } : {}),
  };
}
