import { createClient } from "@/src/lib/supabase/server";
import { STORE_SETTINGS_ID } from "@/src/lib/store/constants";
import { formatOriginLines, originFromSettings, originIsComplete } from "./origin";
import { optionToSnapshot } from "./snapshot";
import { quoteDoorDash } from "./providers/doordash";
import { sanitizeProviderError, type DeliveryOption } from "./types";
import { parseCharge, manualCarrierOptions } from "./manual";
import { taxSettingsFromRow, computeTaxLines, computeOrderTotalCents, moneyFromCents, safeUsdToCents, type TaxLine } from "@/src/lib/tax/totals";
import { estimateIvoireShipping, ivoireShippingConfigFromRow } from "@/src/lib/shipping/estimate";

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

  const destReadyForParcel = Boolean(input.destination.country?.trim());
  const ivoireConfig = ivoireShippingConfigFromRow(settings as Record<string, unknown> | null);
  let ivoireMessage: string | undefined;
  if (destReadyForParcel && input.products.length) {
    const originLabel = formatOriginLines(origin).slice(0, 2).join(", ");
    const ivoire = estimateIvoireShipping({
      config: ivoireConfig,
      packages: input.products,
      destinationCountry: quoteCountry,
      destinationPostalCode: input.destination.postal_code,
      originLabel: originLabel || null,
    });
    if (ivoire?.blocked) {
      ivoireMessage = ivoire.blockReason;
    } else if (ivoire) {
      options.push({
        id: "ivoire:estimate",
        provider: "ivoire",
        fulfillmentMethod: "delivery",
        label: "Ivoire Shop Shipping",
        amount: ivoire.amount,
        serviceCode: ivoire.zoneId || "ivoire-estimate",
        estimate: ivoire.explanation,
        mode: "manual",
        zone: ivoire.zoneName?.toLowerCase().includes("international") ? "international" : "domestic",
        rateMode: "store_rate",
        usedFallback: ivoire.usedFallback,
        billableWeightLb: ivoire.billableWeightLb,
      });
    }
  }

  const breakdowns: Record<string, { shipping: number; tax: number; total: number; taxLines: TaxLine[] }> = {};
  for (const option of options) {
    const shippingCents = safeUsdToCents(option.amount);
    const taxLines = computeTaxLines({
      subtotalCents,
      discountCents: 0,
      shippingCents,
      tax,
    });
    const taxCents = taxLines.reduce((sum, line) => sum + line.cents, 0);
    breakdowns[option.id] = {
      shipping: moneyFromCents(shippingCents),
      tax: moneyFromCents(taxCents),
      taxLines,
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
      message: ivoireMessage || "No delivery methods are available right now. Please try pickup later or contact the store.",
    };
  }
  return {
    options,
    breakdowns,
    subtotal: moneyFromCents(subtotalCents),
    tax,
    origin: originIsComplete(origin) ? origin : null,
    message: options.length
      ? ivoireMessage
      : ivoireMessage || "No delivery methods are available right now. Please try pickup later or contact the store.",
  };
}

export { optionToSnapshot };

