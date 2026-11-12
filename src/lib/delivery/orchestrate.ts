import { createClient } from "@/src/lib/supabase/server";
import { STORE_SETTINGS_ID } from "@/src/lib/store/constants";
import { originFromSettings, originIsComplete } from "./origin";
import { optionToSnapshot } from "./snapshot";
import { quoteDoorDash } from "./providers/doordash";
import { formatUberAddress, quoteUberDelivery } from "./providers/uber-direct";
import { explainUberCheckoutBlocker, uberDirectCredentials, uberDirectEnvironment } from "./credentials";
import { sanitizeProviderError, type DeliveryOption } from "./types";
import { recordUberQuoteEvent } from "./uber-events";
import { parseCharge, manualCarrierOptions, parseRateMode } from "./manual";
import { destinationReadyForCarrierQuotes, destinationReadyForLocalDelivery, incompleteCarrierQuoteMessage } from "./destination";
import { taxSettingsFromRow, computeTaxLines, computeOrderTotalCents, moneyFromCents, safeUsdToCents, type TaxLine } from "@/src/lib/tax/totals";
import { cartParcel, quoteLiveCarrierOptions } from "@/src/lib/shipping/live-quotes";
import { loadShippingPackages } from "@/src/lib/shipping/package-store";
import { liveCarrierApiEnabled, parseShippingProvider } from "@/src/lib/shipping/provider";
import { isCheckoutEligibleShippingOption } from "./checkout-eligibility";
import { collectRateTableOptions } from "@/src/lib/shipping/rate-table";
import { recordShippingMonitorEvent } from "@/src/lib/shipping/monitor";
import { merchandiseSubtotalCents } from "@/src/lib/checkout/merchandise";

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
  destination: { name?: string; phone?: string; address_line_1?: string; address_line_2?: string; city?: string; state?: string; postal_code?: string; country?: string };
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
    item_weight_lb?: number | string | null;
    shipping_package_id?: string | null;
    weightOption?: import("@/src/lib/catalog/weight-options").ProductWeightOption | null;
  }>;
  /** When false, skip Shippo UPS/USPS so pickup/store options return immediately. */
  includeLiveCarriers?: boolean;
}) {
  const merchandise = merchandiseSubtotalCents(input.products);
  const supabase = await createClient();
  const [{ data: settings }, packages] = await Promise.all([
    supabase.from("store_settings").select("*").eq("id", STORE_SETTINGS_ID).maybeSingle(),
    loadShippingPackages(supabase as never),
  ]);
  const origin = originFromSettings(settings);
  const tax = taxSettingsFromRow(settings);
  if (!merchandise.ok) {
    // Merchandise must be confirmed before any shipping quote. Never report a $0.00 product total.
    return {
      options: [],
      breakdowns: {} as Record<string, { shipping: number; tax: number; total: number; taxLines: TaxLine[] }>,
      subtotal: null as number | null,
      tax,
      origin: originIsComplete(origin) ? origin : null,
      expectedLiveCarriers: [] as Array<"ups" | "usps">,
      quoteProvider: parseShippingProvider(settings?.shipping_provider),
      message: merchandise.error,
    };
  }
  const subtotalCents = merchandise.subtotalCents;
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
  const uberSettings = (settings ?? {}) as {
    uber_direct_enabled?: boolean;
    uber_direct_show_at_checkout?: boolean;
    uber_direct_markup_cents?: number;
    uber_direct_production_dispatch?: boolean;
    uber_direct_min_miles?: number | null;
    uber_direct_max_miles?: number | null;
  };
  const uberGate = {
    enabled: uberSettings.uber_direct_enabled === true,
    showAtCheckout: uberSettings.uber_direct_show_at_checkout === true,
    productionDispatchDb: uberSettings.uber_direct_production_dispatch === true,
    minMiles: uberSettings.uber_direct_min_miles ?? null,
    maxMiles: uberSettings.uber_direct_max_miles ?? null,
  };
  // Customer quotes follow enable + show + credentials. Paid dispatch stays separately gated.
  const uberQuoteBlocker = explainUberCheckoutBlocker(uberGate);
  let uberNote = "";
  if (!uberQuoteBlocker && localReady && originIsComplete(origin)) {
    const pickup = formatUberAddress(origin);
    const dropoff = formatUberAddress(input.destination);
    if (!pickup || !dropoff) {
      uberNote = "Enter a complete US delivery address to see an Uber price.";
    } else {
      const quoted = await quoteUberDelivery({
        pickup,
        dropoff,
        markupCents: Number(uberSettings.uber_direct_markup_cents ?? 0),
      });
      logDelivery("uber", "quote", Boolean(quoted.option), quoted.unavailable);
      void recordUberQuoteEvent({
        kind: quoted.option ? "quote_success" : "quote_failure",
        message: quoted.option
          ? `Quoted $${quoted.option.amount.toFixed(2)}${quoted.option.estimate ? ` · ${quoted.option.estimate}` : ""}`
          : (quoted.unavailable ?? "Quote unavailable"),
        feeCents: quoted.option?.uberFeeCents ?? null,
        markupCents: quoted.option?.uberMarkupCents ?? null,
        environment: uberDirectEnvironment(),
        source: "checkout",
      });
      if (quoted.option) options.push(quoted.option);
      else if (quoted.unavailable) uberNote = quoted.unavailable;
    }
  } else if (uberSettings.uber_direct_enabled === true && uberQuoteBlocker) {
    uberNote = uberQuoteBlocker;
  } else if (uberDirectCredentials().configured && uberDirectEnvironment() === "unidentified" && uberSettings.uber_direct_enabled) {
    uberNote = "Local delivery is unavailable until the Uber environment is identified.";
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
        packages,
        defaultPackageId: typeof settings?.default_shipping_package_id === "string" ? settings.default_shipping_package_id : null,
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
  const packed = cartParcel(input.products, {
    packages,
    defaultPackageId: typeof settings?.default_shipping_package_id === "string" ? settings.default_shipping_package_id : null,
  });
  const tableWeight = packed.totalWeightLb ?? packed.parcels.reduce((sum, parcel) => sum + parcel.weightLb, 0);
  const table = destReady
    ? collectRateTableOptions({
        settings: settingsRow,
        destinationCountry: quoteCountry,
        weightLb: tableWeight,
        liveCarrierOptionsPresent: hasLiveCarrier,
      })
    : { options: [] as DeliveryOption[], usedFallback: false, message: undefined as string | undefined };
  if (table.usedFallback) {
    void recordShippingMonitorEvent("rate_table_fallback", {
      reason: hasLiveCarrier ? "skipped_live_present" : "live_unavailable",
      weightLb: tableWeight,
      services: table.options.map((option) => option.serviceCode),
      message: table.message ?? null,
    });
  }
  options.push(...table.options);
  let checkoutMessage: string | undefined = [carrierPrompt, live.message, table.message, uberNote].filter(Boolean).join(" ") || undefined;
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

  const quoteProvider = parseShippingProvider(settings?.shipping_provider);
  if (!eligible.length) {
    return {
      options: eligible,
      breakdowns,
      subtotal: moneyFromCents(subtotalCents),
      tax,
      origin: originIsComplete(origin) ? origin : null,
      expectedLiveCarriers,
      quoteProvider,
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
    quoteProvider,
    message: checkoutMessage,
  };
}

export { optionToSnapshot };
