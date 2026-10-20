import type { DeliveryOption } from "@/src/lib/delivery/types";
import { combinePackages, packageFromProduct, parsePositive } from "@/src/lib/delivery/package";
import { isDomesticCountry, parseRateMode } from "@/src/lib/delivery/manual";
import { originIsComplete, type StoreOrigin } from "@/src/lib/delivery/origin";
import { destinationReadyForCarrierQuotes } from "@/src/lib/delivery/destination";
import { lineShipWeightLb, sellingSettingsFromProduct } from "@/src/lib/catalog/selling";
import {
  applyShippingMargin,
  assignUniqueLiveOptionIds,
  internationalDestinationAllowed,
  isShippoRateLimitStatus,
  listShippoCarrierAccounts,
  liveOptionId,
  parseAllowedServices,
  parseCountryList,
  quoteShippoShipment,
  shippoCredentials,
} from "./shippo";
import { easypostCredentials, quoteEasyPostShipment } from "./easypost";
import { customerFacingEasyPostAllowed, liveCarrierApiEnabled, parseShippingProvider } from "./provider";
import { recordShippingMonitorEvent } from "./monitor";

export type LiveCarrier = "ups" | "usps";

export function cartParcel(products: Array<{
  quantity: number;
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
}>) {
  const packages = [];
  let missing = 0;
  for (const product of products) {
    const settings = sellingSettingsFromProduct(product);
    const lengthIn = parsePositive(product.ship_length_in);
    const widthIn = parsePositive(product.ship_width_in);
    const heightIn = parsePositive(product.ship_height_in);
    if (!lengthIn || !widthIn || !heightIn) {
      missing += 1;
      continue;
    }

    if (settings.sellingMethod === "weight") {
      const weightLb = lineShipWeightLb({
        settings,
        quantity: product.quantity,
        shipWeightLb: product.ship_weight_lb != null ? Number(product.ship_weight_lb) : null,
      });
      if (weightLb == null || weightLb <= 0) {
        missing += 1;
        continue;
      }
      packages.push({ weightLb, lengthIn, widthIn, heightIn });
      continue;
    }

    const dims = packageFromProduct(product);
    if (!dims) {
      missing += 1;
      continue;
    }
    const qty = Number.isFinite(product.quantity) && product.quantity > 0 ? Math.min(Math.ceil(product.quantity), 50) : 1;
    for (let i = 0; i < qty; i += 1) packages.push(dims);
  }
  return { parcel: combinePackages(packages), missing, counted: packages.length };
}

export type LiveQuoteResult = {
  options: DeliveryOption[];
  message?: string;
  expectedLiveCarriers: LiveCarrier[];
  /** Shippo 10429 / rate-limit — selection must not be treated as genuinely unavailable. */
  temporaryBusy?: boolean;
  rateLimitedCarriers?: LiveCarrier[];
};

type QuoteCacheEntry = { at: number; result: LiveQuoteResult };
const liveQuoteCache = new Map<string, QuoteCacheEntry>();
const LIVE_QUOTE_TTL_MS = 45_000;
const LIVE_QUOTE_CACHE_MAX = 40;

function liveQuoteCacheKey(input: {
  origin: StoreOrigin;
  destination: { address_line_1?: string; city?: string; state?: string; postal_code?: string; country?: string };
  parcel: { weightLb: number; lengthIn: number; widthIn: number; heightIn: number };
  carriers: LiveCarrier[];
  allowedServices: string[];
  margin: number;
}) {
  const dest = input.destination;
  return [
    input.carriers.join(","),
    input.allowedServices.join(","),
    String(input.margin),
    [
      input.origin.address_line_1,
      input.origin.city,
      input.origin.state,
      input.origin.postal_code,
      input.origin.country,
    ].join("|"),
    [
      dest.address_line_1,
      dest.city,
      dest.state,
      dest.postal_code,
      (dest.country || "US").slice(0, 2).toUpperCase(),
    ].join("|"),
    [
      input.parcel.weightLb.toFixed(3),
      input.parcel.lengthIn.toFixed(2),
      input.parcel.widthIn.toFixed(2),
      input.parcel.heightIn.toFixed(2),
    ].join("x"),
  ].join("::");
}

function readLiveQuoteCache(key: string): LiveQuoteResult | null {
  const hit = liveQuoteCache.get(key);
  if (!hit) return null;
  if (Date.now() - hit.at > LIVE_QUOTE_TTL_MS) {
    liveQuoteCache.delete(key);
    return null;
  }
  return hit.result;
}

function writeLiveQuoteCache(key: string, result: LiveQuoteResult) {
  liveQuoteCache.set(key, { at: Date.now(), result });
  if (liveQuoteCache.size > LIVE_QUOTE_CACHE_MAX) {
    const oldest = [...liveQuoteCache.entries()].sort((a, b) => a[1].at - b[1].at)[0];
    if (oldest) liveQuoteCache.delete(oldest[0]);
  }
}

function isShippoRateLimitMessage(text: string) {
  return isShippoRateLimitStatus(0, text);
}

function temporaryBusyResult(input: {
  options: DeliveryOption[];
  remaining: LiveCarrier[];
  busyCarriers: LiveCarrier[];
  reason: "rate_limit" | "silent_omit";
}): LiveQuoteResult {
  const busy = input.busyCarriers.map((carrier) => carrier.toUpperCase()).join(" and ");
  const message = input.reason === "rate_limit"
    ? `${busy} rates are temporarily busy (carrier API limit). Your selected ${busy} rate is kept when already chosen — wait a moment before refreshing rates.`
    : `${busy} rates did not return on this pass while other carriers did. This is treated as a temporary carrier gap — your selected ${busy} rate is kept when already chosen.`;
  return {
    options: input.options,
    expectedLiveCarriers: input.remaining,
    temporaryBusy: true,
    rateLimitedCarriers: input.busyCarriers,
    message,
  };
}

export async function quoteLiveCarrierOptions(input: {
  settings: Record<string, unknown> | null | undefined;
  origin: StoreOrigin;
  destination: { address_line_1?: string; city?: string; state?: string; postal_code?: string; country?: string };
  products: Parameters<typeof cartParcel>[0];
}): Promise<LiveQuoteResult> {
  const settings = input.settings ?? {};
  const provider = parseShippingProvider(settings.shipping_provider);
  const liveOn = liveCarrierApiEnabled(settings);
  const liveCarriers = (["ups", "usps"] as const).filter((carrier) => {
    return liveOn
      && Boolean(settings[`${carrier}_enabled`])
      && settings[`${carrier}_show_at_checkout`] !== false
      && parseRateMode(settings[`${carrier}_rate_mode`]) === "live_api";
  });
  if (!liveCarriers.length) return { options: [], expectedLiveCarriers: [] };

  const international = !isDomesticCountry(input.destination.country);
  const allowlist = parseCountryList(settings.shippo_international_countries);
  if (international && !internationalDestinationAllowed(input.destination.country, allowlist)) {
    return {
      options: [],
      expectedLiveCarriers: liveCarriers,
      message: "This destination is not on the founder international shipping list.",
    };
  }
  const remaining = liveCarriers.filter((carrier) => (
    international ? Boolean(settings[`${carrier}_international_enabled`]) : Boolean(settings[`${carrier}_domestic_enabled`])
  ));
  if (!remaining.length) return { options: [], expectedLiveCarriers: liveCarriers };

  const shippo = shippoCredentials();
  const easypost = easypostCredentials();
  if (provider === "easypost") {
    if (!easypost.configured) {
      await recordShippingMonitorEvent("quote_failure", { reason: "easypost_not_configured", carriers: remaining });
      return {
        options: [],
        expectedLiveCarriers: remaining,
        message: "Live UPS/USPS quotes are enabled, but EasyPost is not configured on this environment.",
      };
    }
    if (!customerFacingEasyPostAllowed({
      provider,
      isTest: easypost.isTest,
      customerRatesEnabled: settings.easypost_customer_rates_enabled === true,
    })) {
      await recordShippingMonitorEvent("quote_failure", { reason: "easypost_customer_rates_locked", carriers: remaining });
      return {
        options: [],
        expectedLiveCarriers: remaining,
        message: "EasyPost production quotes stay off at checkout until the founder enables customer-facing live rates after a verified production quote. Store Pickup remains available.",
      };
    }
  } else {
    if (!shippo.configured) {
      await recordShippingMonitorEvent("quote_failure", { reason: "not_configured", carriers: remaining });
      return {
        options: [],
        expectedLiveCarriers: remaining,
        message: "Live UPS/USPS quotes are enabled, but Shippo is not configured on this environment.",
      };
    }
    if (shippo.isLive) {
      await recordShippingMonitorEvent("quote_failure", { reason: "live_token_blocked" });
      return {
        options: [],
        expectedLiveCarriers: remaining,
        message: "A live Shippo token is present. Checkout will not request live postage quotes until the founder approves production shipping.",
      };
    }
  }
  if (!originIsComplete(input.origin) || !destinationReadyForCarrierQuotes(input.destination)) {
    return {
      options: [],
      expectedLiveCarriers: remaining,
      message: "Enter a complete destination and confirm the store shipping origin to request UPS/USPS rates.",
    };
  }

  const packed = cartParcel(input.products);
  if (!packed.parcel || packed.missing) {
    await recordShippingMonitorEvent("missing_parcel", { missingProducts: packed.missing, items: input.products.length });
    if (settings.shippo_allow_manual_fallback === true) {
      return {
        options: [],
        expectedLiveCarriers: remaining,
        message: "Package weight or dimensions are missing. Manual store charges are allowed as a labeled fallback only from Shipping Rate Manager, not automatically.",
      };
    }
    return {
      options: [],
      expectedLiveCarriers: remaining,
      message: "Package weight and dimensions are required for UPS/USPS quotes. Missing product shipping data is never invented.",
    };
  }

  const allowedServices = parseAllowedServices(settings.shippo_allowed_services);
  const margin = Number(settings.shippo_margin_percent ?? 0);
  const cacheKey = `${provider}::${liveQuoteCacheKey({
    origin: input.origin,
    destination: input.destination,
    parcel: packed.parcel,
    carriers: remaining,
    allowedServices,
    margin,
  })}`;
  const cached = readLiveQuoteCache(cacheKey);
  if (cached) return cached;

  if (provider === "easypost") {
    const quoted = await quoteEasyPostShipment({
      origin: input.origin,
      destination: input.destination,
      parcel: packed.parcel,
      allowedServices,
    });
    if (!quoted.ok) {
      await recordShippingMonitorEvent("quote_failure", {
        reason: quoted.rateLimited ? "easypost_rate_limited" : "easypost_error",
        carriers: remaining,
        status: quoted.status ?? null,
      });
      if (quoted.rateLimited) {
        return temporaryBusyResult({
          options: [],
          remaining,
          busyCarriers: remaining,
          reason: "rate_limit",
        });
      }
      return {
        options: [],
        expectedLiveCarriers: remaining,
        message: "EasyPost could not return UPS/USPS rates for this destination. The checkout did not substitute a manual estimate.",
      };
    }
    const options = assignUniqueLiveOptionIds(quoted.rates
      .filter((rate) => remaining.includes(rate.provider))
      .map((rate) => {
        const eta = rate.estimatedDays != null
          ? `${rate.estimatedDays} business day${rate.estimatedDays === 1 ? "" : "s"}`
          : rate.durationTerms;
        return {
          id: liveOptionId(rate.provider, rate.service, { token: rate.serviceToken, days: rate.estimatedDays }),
          provider: rate.provider,
          fulfillmentMethod: "delivery" as const,
          label: `${rate.provider.toUpperCase()} · ${rate.service}`,
          amount: applyShippingMargin(rate.amount, margin),
          serviceCode: rate.service || rate.serviceToken,
          serviceToken: rate.serviceToken || undefined,
          estimate: [
            eta,
            easypost.isTest || rate.test ? "EasyPost TEST rate — not a production quote" : "EasyPost carrier rate",
          ].filter(Boolean).join(" · "),
          mode: "api" as const,
          zone: international ? "international" as const : "domestic" as const,
          rateMode: "live_api" as const,
          billableWeightLb: packed.parcel!.weightLb,
          easypostRateId: rate.objectId,
          easypostShipmentId: rate.shipmentId,
          quoteSource: "easypost" as const,
          testRate: easypost.isTest || rate.test,
          etaDays: rate.estimatedDays,
        };
      }));
    await recordShippingMonitorEvent("checkout_quote", {
      provider: "easypost",
      rates: options.length,
      upsRates: options.filter((option) => option.provider === "ups").length,
      uspsRates: options.filter((option) => option.provider === "usps").length,
      test: easypost.isTest,
      country: String(input.destination.country || "").slice(0, 2).toUpperCase(),
      weightLb: packed.parcel.weightLb,
    });
    if (!options.length) {
      return {
        options: [],
        expectedLiveCarriers: remaining,
        message: `EasyPost returned no eligible ${remaining.map((carrier) => carrier.toUpperCase()).join(" and ")} services for this destination and parcel. No substitute rate was invented.`,
      };
    }
    const missingCarriers = remaining.filter((carrier) => !options.some((option) => option.provider === carrier));
    const success = {
      options,
      expectedLiveCarriers: remaining,
      message: missingCarriers.length
        ? `${missingCarriers.map((carrier) => carrier.toUpperCase()).join(" and ")} did not return a rate for this destination and parcel. Showing available EasyPost rates only.`
        : undefined,
    };
    writeLiveQuoteCache(cacheKey, success);
    return success;
  }

  const accounts = await listShippoCarrierAccounts();
  let quoted = await quoteShippoShipment({
    origin: input.origin,
    destination: input.destination,
    parcel: packed.parcel,
    allowedServices,
  });
  // Bounded single backoff for Shippo 10429 — never loop. Callers must not spam Shippo after a selection.
  const hitRateLimit = (!quoted.ok && Boolean(quoted.rateLimited))
    || (quoted.carrierMessages ?? []).some(isShippoRateLimitMessage);
  if (hitRateLimit) {
    const missingAfterLimit = remaining.filter((carrier) => !quoted.rates.some((rate) => rate.provider === carrier));
    if (missingAfterLimit.length || !quoted.ok) {
      await new Promise((resolve) => setTimeout(resolve, 1600));
      const retry = await quoteShippoShipment({
        origin: input.origin,
        destination: input.destination,
        parcel: packed.parcel,
        allowedServices,
      });
      if (retry.ok) {
        const retryCoversMore = missingAfterLimit.some((carrier) => retry.rates.some((rate) => rate.provider === carrier));
        if (retryCoversMore || retry.rates.length > quoted.rates.length || !quoted.ok) quoted = retry;
      } else if (!quoted.ok && retry.rateLimited) {
        quoted = retry;
      }
    }
  }
  if (!quoted.ok) {
    const rateLimited = Boolean(quoted.rateLimited)
      || (quoted.carrierMessages ?? []).some(isShippoRateLimitMessage);
    await recordShippingMonitorEvent("quote_failure", {
      reason: rateLimited ? "shippo_rate_limited" : "shippo_error",
      carriers: remaining,
      upsAccounts: accounts.ups,
      uspsAccounts: accounts.usps,
      status: quoted.status ?? null,
    });
    if (rateLimited) {
      const busy = temporaryBusyResult({
        options: [],
        remaining,
        busyCarriers: remaining,
        reason: "rate_limit",
      });
      return busy;
    }
    return {
      options: [],
      expectedLiveCarriers: remaining,
      message: "Shippo could not return UPS/USPS rates for this destination. The checkout did not substitute a manual estimate.",
    };
  }

  const options: DeliveryOption[] = assignUniqueLiveOptionIds(quoted.rates
    .filter((rate) => remaining.includes(rate.provider))
    .map((rate) => {
      const eta = rate.estimatedDays != null
        ? `${rate.estimatedDays} business day${rate.estimatedDays === 1 ? "" : "s"}`
        : rate.durationTerms;
      return {
        id: liveOptionId(rate.provider, rate.service, { token: rate.serviceToken, days: rate.estimatedDays }),
        provider: rate.provider,
        fulfillmentMethod: "delivery" as const,
        label: `${rate.provider.toUpperCase()} · ${rate.service}`,
        amount: applyShippingMargin(rate.amount, margin),
        serviceCode: rate.service || rate.serviceToken,
        serviceToken: rate.serviceToken || undefined,
        estimate: [
          eta,
          shippo.isTest || rate.test ? "Shippo test rate — not a production quote" : "Shippo carrier rate",
        ].filter(Boolean).join(" · "),
        mode: "api" as const,
        zone: international ? "international" as const : "domestic" as const,
        rateMode: "live_api" as const,
        billableWeightLb: packed.parcel!.weightLb,
        shippoRateId: rate.objectId,
        quoteSource: "shippo" as const,
        testRate: shippo.isTest || rate.test,
        etaDays: rate.estimatedDays,
      };
    }));

  const upsRates = options.filter((option) => option.provider === "ups").length;
  const uspsRates = options.filter((option) => option.provider === "usps").length;
  const upsMessages = (quoted.carrierMessages || []).filter((text) => text.startsWith("UPS"));
  const uspsMessages = (quoted.carrierMessages || []).filter((text) => text.startsWith("USPS"));
  const anyRateLimitMessage = (quoted.carrierMessages || []).some(isShippoRateLimitMessage)
    || Boolean(quoted.rateLimited);

  await recordShippingMonitorEvent("checkout_quote", {
    rates: options.length,
    upsRates,
    uspsRates,
    upsAccounts: accounts.ups,
    uspsAccounts: accounts.usps,
    provider: "shippo",
    test: shippo.isTest,
    country: String(input.destination.country || "").slice(0, 2).toUpperCase(),
    weightLb: packed.parcel.weightLb,
    rateLimited: anyRateLimitMessage,
  });

  if (!options.length) {
    if (anyRateLimitMessage) {
      return temporaryBusyResult({
        options: [],
        remaining,
        busyCarriers: remaining,
        reason: "rate_limit",
      });
    }
    const wanted = remaining.map((carrier) => carrier.toUpperCase()).join(" and ");
    return {
      options: [],
      expectedLiveCarriers: remaining,
      message: `Shippo returned no eligible ${wanted} services for this destination and parcel. Carriers stay enabled in admin; no substitute rate was invented.`,
    };
  }

  const missingCarriers = remaining.filter((carrier) => !options.some((option) => option.provider === carrier));
  if (missingCarriers.length) {
    const present = [...new Set(options.map((option) => option.provider.toUpperCase()))].join(", ");
    const rateLimitedCarriers = missingCarriers.filter((carrier) => {
      const msgs = carrier === "ups" ? upsMessages : uspsMessages;
      return msgs.some(isShippoRateLimitMessage) || anyRateLimitMessage;
    });
    // Silent UPS/USPS omission while sibling carriers return rates is the intermittent Shippo pattern
    // seen in staging monitor (upsRates 0 → 7 within seconds). Treat as temporary, not permanent.
    const silentOmitCarriers = missingCarriers.filter((carrier) => {
      if (rateLimitedCarriers.includes(carrier)) return false;
      const msgs = carrier === "ups" ? upsMessages : uspsMessages;
      return msgs.length === 0;
    });
    const busyCarriers = [...new Set([...rateLimitedCarriers, ...silentOmitCarriers])];
    if (busyCarriers.length) {
      const busy = temporaryBusyResult({
        options,
        remaining,
        busyCarriers,
        reason: rateLimitedCarriers.length ? "rate_limit" : "silent_omit",
      });
      writeLiveQuoteCache(cacheKey, busy);
      return busy;
    }
    const missing = missingCarriers.map((carrier) => carrier.toUpperCase()).join(" and ");
    const apiHint = missingCarriers.includes("ups") && upsMessages.length
      ? ` Shippo UPS note: ${upsMessages[0]}`
      : missingCarriers.includes("usps") && uspsMessages.length
        ? ` Shippo USPS note: ${uspsMessages[0]}`
        : "";
    const result = {
      options,
      expectedLiveCarriers: remaining,
      message: `${missing} did not return a rate for this destination and parcel.${apiHint} Showing available ${present} test rates only. This is a carrier/API quote result, not a disabled setting.`,
    };
    writeLiveQuoteCache(cacheKey, result);
    return result;
  }
  const success = { options, expectedLiveCarriers: remaining };
  writeLiveQuoteCache(cacheKey, success);
  return success;
}
