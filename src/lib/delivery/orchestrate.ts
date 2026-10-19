import { createClient } from "@/src/lib/supabase/server";
import { STORE_SETTINGS_ID } from "@/src/lib/store/constants";
import { formatOriginLines, originFromSettings, originIsComplete } from "./origin";
import { optionToSnapshot } from "./snapshot";
import { quoteDoorDash } from "./providers/doordash";
import { sanitizeProviderError, type DeliveryOption } from "./types";
import { parseCharge, manualCarrierOptions, parseRateMode } from "./manual";
import { destinationReadyForCarrierQuotes, destinationReadyForLocalDelivery, incompleteCarrierQuoteMessage } from "./destination";
import { taxSettingsFromRow, computeTaxLines, computeOrderTotalCents, moneyFromCents, safeUsdToCents, type TaxLine } from "@/src/lib/tax/totals";
import { estimateIvoireShipping, ivoireShippingConfigFromRow } from "@/src/lib/shipping/estimate";
import { quoteLiveCarrierOptions } from "@/src/lib/shipping/live-quotes";
import { lineShipWeightLb, sellingSettingsFromProduct } from "@/src/lib/catalog/selling";

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
  if (settings?.store_delivery_enabled !== false && settings?.store_delivery_show_at_checkout !== false && localReady) {
    options.push({
      id: "store",
      provider: "store",
      fulfillmentMethod: "delivery",
      label: "Delivery · Arranged by Ivoire Shop",
      amount: parseCharge(settings?.store_delivery_charge) ?? 0,
    });
  }

  const tax = taxSettingsFromRow(settings);
  const subtotalCents = input.products.reduce((sum, product) => {
    const qty = Number(product.quantity);
    const price = Number(product.price);
    if (!Number.isFinite(qty) || qty <= 0 || !Number.isFinite(price) || price <= 0) return sum;
    return sum + Math.round(price * qty * 100);
  }, 0);
  const row = (settings ?? {}) as Record<string, unknown>;
  const liveCarriersWanted = row.shippo_enabled === true && (["ups", "usps"] as const).some((carrier) => (
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
  options.push(...manualCarrierOptions(settings as Record<string, unknown> | null, quoteCountry, moneyFromCents(subtotalCents)));
  const settingsRow = (settings ?? {}) as Record<string, unknown>;
  const expectedFromSettings = (["ups", "usps"] as const).filter((carrier) => (
    settingsRow.shippo_enabled === true
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
        message: includeLive && liveCarriersWanted && !destReady
          ? undefined
          : undefined as string | undefined,
        expectedLiveCarriers: expectedFromSettings,
      };
  options.push(...live.options);
  const expectedLiveCarriers = live.expectedLiveCarriers.length ? live.expectedLiveCarriers : expectedFromSettings;

  const destReadyForParcel = Boolean(input.destination.country?.trim());
  const ivoireConfig = ivoireShippingConfigFromRow(settings as Record<string, unknown> | null);
  const carrierPrompt = liveCarriersWanted && !destReady ? incompleteCarrierQuoteMessage(input.destination) : "";
  let ivoireMessage: string | undefined = [carrierPrompt, live.message].filter(Boolean).join(" ") || undefined;
  if (destReadyForParcel && input.products.length) {
    const originLabel = formatOriginLines(origin).slice(0, 2).join(", ");
    const estimatePackages = input.products.map((product) => {
      const settings = sellingSettingsFromProduct(product);
      if (settings.sellingMethod === "weight") {
        const weightLb = lineShipWeightLb({
          settings,
          quantity: product.quantity,
          shipWeightLb: product.ship_weight_lb != null ? Number(product.ship_weight_lb) : null,
        });
        return {
          quantity: 1,
          ship_weight_lb: weightLb,
          ship_length_in: product.ship_length_in,
          ship_width_in: product.ship_width_in,
          ship_height_in: product.ship_height_in,
          forbidPackageDefaults: true,
        };
      }
      return {
        quantity: product.quantity,
        ship_weight_lb: product.ship_weight_lb,
        ship_length_in: product.ship_length_in,
        ship_width_in: product.ship_width_in,
        ship_height_in: product.ship_height_in,
      };
    });
    const ivoire = estimateIvoireShipping({
      config: ivoireConfig,
      packages: estimatePackages,
      destinationCountry: quoteCountry,
      destinationPostalCode: input.destination.postal_code,
      originLabel: originLabel || null,
    });
    const hasWeightProduct = input.products.some(
      (product) => sellingSettingsFromProduct(product).sellingMethod === "weight",
    );
    if (ivoire?.blocked) {
      ivoireMessage = [carrierPrompt, live.message, ivoire.blockReason].filter(Boolean).join(" ") || undefined;
    } else if (ivoire && hasWeightProduct && ivoire.usedDefaults) {
      ivoireMessage = [
        carrierPrompt,
        live.message,
        "Ivoire Shop shipping needs configured package dimensions for weight-based products. Purchased weight is used as product weight; package defaults are never invented.",
      ].filter(Boolean).join(" ") || undefined;
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
      expectedLiveCarriers,
      message: ivoireMessage || "No delivery methods are available right now. Please try pickup later or contact the store.",
    };
  }
  return {
    options,
    breakdowns,
    subtotal: moneyFromCents(subtotalCents),
    tax,
    origin: originIsComplete(origin) ? origin : null,
    expectedLiveCarriers,
    message: options.length
      ? ivoireMessage
      : ivoireMessage || "No delivery methods are available right now. Please try pickup later or contact the store.",
  };
}

export { optionToSnapshot };

