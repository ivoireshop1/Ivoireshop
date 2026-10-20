import { createClient } from "@/src/lib/supabase/server";
import { STORE_SETTINGS_ID } from "@/src/lib/store/constants";
import { originFromSettings, originIsComplete } from "./origin";
import { optionToSnapshot } from "./snapshot";
import { quoteDoorDash } from "./providers/doordash";
import { sanitizeProviderError, type DeliveryOption } from "./types";
import { parseCharge, manualCarrierOptions, parseRateMode } from "./manual";
import { destinationReadyForCarrierQuotes, destinationReadyForLocalDelivery, incompleteCarrierQuoteMessage } from "./destination";
import { taxSettingsFromRow, computeTaxLines, computeOrderTotalCents, moneyFromCents, safeUsdToCents, type TaxLine } from "@/src/lib/tax/totals";
import { quoteLiveCarrierOptions } from "@/src/lib/shipping/live-quotes";
import { liveCarrierApiEnabled } from "@/src/lib/shipping/provider";
import { isCheckoutEligibleShippingOption } from "./checkout-eligibility";

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
    selling_method?: string | null;
    selling_unit?: string | null;
    unit_increment?: number | string | null;
    min_sell_qty?: number | string | null;
    max_sell_qty?: number | string | null;
    package_weight_lb?: number | string | null;
    ship_weight_lb?: number | string | null;
    ship_length_in?: number | string | null;
    ship_width_in?: number | string | null;
    ship_height_in?: number | string | null;
  }>;
  /** When false, skip Shippo UPS/USPS so pickup/store options return immediately. */
  includeLiveCarriers?: boolean;
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
  const destReady = destinationReadyForCarrierQuotes(input.destination);
  const localReady = destinationReadyForLocalDelivery(input.destination);
  // Local delivery only when explicitly enabled and shown — never offer an unconfigured $0 method.
  if (settings?.store_delivery_enabled === true && settings?.store_delivery_show_at_checkout === true && localReady) {
    const charge = parseCharge(settings?.store_delivery_charge);
    if (charge != null && charge >= 0) {
      options.push({
        id: "store",
        provider: "store",
        fulfillmentMethod: "delivery",
        label: "Delivery · Arranged by Ivoire Shop",
        amount: charge,
      });
    }
  }

  const tax = taxSettingsFromRow(settings);
  const subtotalCents = input.products.reduce((sum, product) => {
    const qty = Number(product.quantity);
    const price = Number(product.price);
    if (!Number.isFinite(qty) || qty <= 0 || !Number.isFinite(price) || price <= 0) return sum;
    return sum + Math.round(price * qty * 100);
  }, 0);
  const row = (settings ?? {}) as Record<string, unknown>;
  const liveCarriersWanted = liveCarrierApiEnabled(row) && (["ups", "usps"] as const).some((carrier) => (
    Boolean(row[`${carrier}_enabled`])
    && row[`${carrier}_show_at_checkout`] !== false
    && parseRateMode(row[`${carrier}_rate_mode`]) === "live_api"
  ));
  if (destReady && originIsComplete(origin) && settings?.doordash_enabled) {
    const quoted = await quoteDoorDash({ origin, destination: input.destination });
    logDelivery("doordash", "quote", !quoted.error, quoted.error);
    options.push(...quoted.options.map((option) => ({ ...option, mode: "api" as const })));
  }
  const quoteCountry = input.destination.country?.trim() || origin.country?.trim() || "US";
  // Manual/store UPS/USPS rates stay gated; production must never substitute them for live quotes.
  options.push(...manualCarrierOptions(settings as Record<string, unknown> | null, quoteCountry, moneyFromCents(subtotalCents)));
  const settingsRow = (settings ?? {}) as Record<string, unknown>;
  const expectedFromSettings = (["ups", "usps"] as const).filter((carrier) => (
    liveCarrierApiEnabled(settingsRow)
    && Boolean(settingsRow[`${carrier}_enabled`])
    && settingsRow[`${carrier}_show_at_checkout`] !== false
    && parseRateMode(settingsRow[`${carrier}_rate_mode`]) === "live_api"
  ));
  const includeLive = input.includeLiveCarriers !== false;
  const live = includeLive && destReady && originIsComplete(origin)
    ? await quoteLiveCarrierOptions({
        settings: settings as Record<string, unknown> | null,
        origin,
        destination: input.destination,
        products: input.products,
      })
    : {
        options: [] as typeof options,
        message: undefined as string | undefined,
        expectedLiveCarriers: expectedFromSettings,
      };
  options.push(...live.options);
  const expectedLiveCarriers = live.expectedLiveCarriers.length ? live.expectedLiveCarriers : expectedFromSettings;

  const carrierPrompt = liveCarriersWanted && !destReady ? incompleteCarrierQuoteMessage(input.destination) : "";
  const hasPickup = options.some((option) => option.provider === "pickup");
  const hasLiveCarrier = options.some((option) => (option.provider === "ups" || option.provider === "usps") && option.rateMode === "live_api");
  let checkoutMessage: string | undefined = [carrierPrompt, live.message].filter(Boolean).join(" ") || undefined;
  if (liveCarriersWanted && destReady && !hasLiveCarrier && !live.temporaryBusy) {
    const unavailable =
      "Live UPS/USPS rates are unavailable for this address and package right now."
      + (hasPickup ? " Store Pickup is still available." : " Please try again later or contact the store.");
    checkoutMessage = [checkoutMessage, unavailable].filter(Boolean).join(" ");
  }

  // Never offer retired Ivoire Shop store-calculated shipping or non-live carrier store rates.
  const eligible = options.filter(isCheckoutEligibleShippingOption);

  const breakdowns: Record<string, { shipping: number; tax: number; total: number; taxLines: TaxLine[] }> = {};
  for (const option of eligible) {
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

  if (!eligible.length) {
    return {
      options: eligible,
      breakdowns,
      subtotal: moneyFromCents(subtotalCents),
      tax,
      origin: originIsComplete(origin) ? origin : null,
      expectedLiveCarriers,
      message: checkoutMessage || "No delivery methods are available right now. Please try pickup later or contact the store.",
    };
  }
  return {
    options: eligible,
    breakdowns,
    subtotal: moneyFromCents(subtotalCents),
    tax,
    origin: originIsComplete(origin) ? origin : null,
    expectedLiveCarriers,
    message: checkoutMessage,
  };
}

export { optionToSnapshot };
