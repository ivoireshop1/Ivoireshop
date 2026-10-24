import type { DeliveryOption } from "@/src/lib/delivery/types";
import { parcelFailureMessage, resolveCartParcel, type ShippingPackagePreset } from "@/src/lib/shipping/packages";
import { isDomesticCountry, parseRateMode } from "@/src/lib/delivery/manual";
import { originIsComplete, type StoreOrigin } from "@/src/lib/delivery/origin";
import { destinationReadyForCarrierQuotes } from "@/src/lib/delivery/destination";
import {
  applyShippingMargin,
  assignUniqueLiveOptionIds,
  isShippoRateLimitStatus,
  listShippoCarrierAccounts,
  liveOptionId,
  parseAllowedServices,
  parseCountryList,
  quoteShippoShipment,
  shippoCredentials,
  shippoMissingCarrierMessage,
  internationalEligibility,
} from "./shippo";
import { easypostCredentials, quoteEasyPostShipment } from "./easypost";
import { easyshipCredentials, easyshipQuoteErrorMessage, easyshipQuoteItems, quoteEasyshipRates } from "./easyship";
import { customerFacingEasyPostAllowed, customerFacingEasyShipAllowed, customerFacingShippoAllowed, liveCarrierApiEnabled, parseShippingProvider } from "./provider";
import { cartUsesEstimatedWeight, recordShippingMonitorEvent, recordShippingQuoteLog } from "./monitor";
import { shippingLiveRatesEnabled, LIVE_RATES_DISABLED_MESSAGE } from "./live-rates-switch";
import { cartCustomsReady } from "./customs";

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
  item_weight_lb?: number | string | null;
  shipping_package_id?: string | null;
  weight_oz?: number | string | null;
  packaging_weight_oz?: number | string | null;
  weight_source?: string | null;
  dims?: unknown;
  id?: string;
  name?: string | null;
  description?: string | null;
  short_description?: string | null;
  price?: number | string | null;
  category_slug?: string | null;
  category?: string | null;
  hs_code?: string | null;
  origin_country_alpha2?: string | null;
  origin_country?: string | null;
  weightOption?: Parameters<typeof resolveCartParcel>[0]["products"][number]["weightOption"];
}>, extras?: { packages?: ShippingPackagePreset[]; defaultPackageId?: string | null }) {
  return resolveCartParcel({
    products,
    packages: extras?.packages,
    defaultPackageId: extras?.defaultPackageId,
  });
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
  parcels?: Array<{ weightLb: number; lengthIn: number; widthIn: number; heightIn: number }>;
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
    (input.parcels?.length ? input.parcels : [input.parcel]).map((parcel) => (
      [parcel.weightLb.toFixed(3), parcel.lengthIn.toFixed(2), parcel.widthIn.toFixed(2), parcel.heightIn.toFixed(2)].join("x")
    )).join("+"),
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
  packages?: ShippingPackagePreset[];
  defaultPackageId?: string | null;
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
  if (!shippingLiveRatesEnabled()) {
    await recordShippingQuoteLog({
      usedEstimatedWeight: false,
      weightSources: input.products.map((product) => product.weight_source ?? null),
      message: "live_rates_disabled",
      status: "error",
    });
    return {
      options: [],
      expectedLiveCarriers: liveCarriers,
      message: LIVE_RATES_DISABLED_MESSAGE,
    };
  }

  const international = !isDomesticCountry(input.destination.country);
  const allowlist = parseCountryList(settings.shippo_international_countries);
  const eligibility = internationalEligibility(input.destination.country, allowlist);
  if (international && !eligibility.allowed) {
    await recordShippingQuoteLog({
      usedEstimatedWeight: false,
      weightSources: input.products.map((product) => product.weight_source ?? null),
      message: eligibility.reason === "not_configured" ? "international_not_configured" : "international_not_listed",
      status: "error",
    });
    return {
      options: [],
      expectedLiveCarriers: liveCarriers,
      message: eligibility.message,
    };
  }
  const remaining = liveCarriers.filter((carrier) => (
    international ? Boolean(settings[`${carrier}_international_enabled`]) : Boolean(settings[`${carrier}_domestic_enabled`])
  ));
  if (!remaining.length) return { options: [], expectedLiveCarriers: liveCarriers };

  const shippo = shippoCredentials();
  const easypost = easypostCredentials();
  const easyship = easyshipCredentials();
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
  } else if (provider === "easyship") {
    if (!easyship.configured) {
      await recordShippingMonitorEvent("quote_failure", { reason: "easyship_not_configured", carriers: remaining });
      return {
        options: [],
        expectedLiveCarriers: remaining,
        message: easyshipQuoteErrorMessage("not_configured"),
      };
    }
    if (easyship.mode === "unknown") {
      await recordShippingMonitorEvent("quote_failure", { reason: "easyship_unrecognized_key", carriers: remaining });
      return {
        options: [],
        expectedLiveCarriers: remaining,
        message: easyshipQuoteErrorMessage("unrecognized_key"),
      };
    }
    if (!customerFacingEasyShipAllowed({
      provider,
      isSandbox: easyship.isSandbox,
      isProduction: easyship.isProduction,
      customerRatesEnabled: settings.easyship_customer_rates_enabled === true,
    })) {
      await recordShippingMonitorEvent("quote_failure", {
        reason: easyship.isSandbox ? "easyship_sandbox_rates_locked" : "easyship_customer_rates_locked",
        carriers: remaining,
      });
      return {
        options: [],
        expectedLiveCarriers: remaining,
        message: easyship.isSandbox
          ? "Easyship sandbox rates stay off at checkout. They are not live customer prices. Store Pickup remains available."
          : "Easyship production quotes stay off at checkout until the founder enables customer-facing live rates after a verified production quote. Store Pickup remains available.",
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
    if (!customerFacingShippoAllowed({
      provider,
      isTest: shippo.isTest,
      isLive: shippo.isLive,
      customerRatesEnabled: shippingLiveRatesEnabled(),
    })) {
      await recordShippingMonitorEvent("quote_failure", {
        reason: shippo.isTest ? "shippo_test_rates_locked" : "shippo_customer_rates_locked",
        carriers: remaining,
      });
      return {
        options: [],
        expectedLiveCarriers: remaining,
        message: shippo.isTest
          ? "Shippo TEST rates stay off at checkout. They are sandbox prices, not live customer rates. Store Pickup remains available."
          : "Shippo checkout rates stay off until the founder enables live customer quotes. Store Pickup remains available.",
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

  const products = input.products;
  if (international) {
    const customs = cartCustomsReady(products, true);
    if (!customs.ok) {
      await recordShippingQuoteLog({
        usedEstimatedWeight: false,
        weightSources: products.map((product) => product.weight_source ?? null),
        message: "missing_customs",
        status: "error",
      });
      return {
        options: [],
        expectedLiveCarriers: remaining,
        message: customs.message,
      };
    }
  }
  const packed = cartParcel(products, {
    packages: input.packages,
    defaultPackageId: input.defaultPackageId ?? (typeof settings.default_shipping_package_id === "string" ? settings.default_shipping_package_id : null),
  });
  const usedEstimatedWeight = packed.usedEstimatedWeight || cartUsesEstimatedWeight(products);
  const usedEstimatedBox = Boolean(packed.usedEstimatedBox);
  if (!packed.parcels?.length || packed.missing) {
    await recordShippingMonitorEvent("missing_parcel", {
      missingProducts: packed.missing,
      items: products.length,
      code: packed.code ?? "missing_parcel",
      usedEstimatedWeight,
      usedEstimatedBox,
    });
    await recordShippingQuoteLog({
      usedEstimatedWeight,
      usedEstimatedBox,
      weightSources: products.map((product) => ({
        id: product.id ?? null,
        source: product.weight_source ?? packed.reviews?.find((row) => row.name === (product.name || product.description))?.source ?? null,
        review: packed.reviews?.find((row) => row.name === (product.name || product.description))?.reason ?? null,
      })),
      parcel: packed.parcel,
      message: packed.message ?? packed.code ?? "missing_parcel",
      status: packed.code ?? "missing_parcel",
    });
    if (settings.shippo_allow_manual_fallback === true) {
      return {
        options: [],
        expectedLiveCarriers: remaining,
        message: `${packed.message ?? parcelFailureMessage("missing_parcel")} Manual store charges are allowed as a labeled fallback only from Shipping Rate Manager, not automatically.`,
      };
    }
    return {
      options: [],
      expectedLiveCarriers: remaining,
      message: packed.message ?? parcelFailureMessage(packed.code ?? "missing_parcel"),
    };
  }
  const quoteParcel = packed.parcels[0];
  const quoteWeightLb = packed.totalWeightLb ?? packed.parcels.reduce((sum, parcel) => sum + parcel.weightLb, 0);
  if (!quoteParcel) {
    return {
      options: [],
      expectedLiveCarriers: remaining,
      message: parcelFailureMessage("missing_parcel"),
    };
  }

  await recordShippingQuoteLog({
    usedEstimatedWeight,
    usedEstimatedBox,
    weightSources: products.map((product) => ({ id: product.id ?? null, source: product.weight_source ?? null })),
    parcel: packed.parcels.length === 1
      ? {
        weightLb: quoteParcel.weightLb,
        lengthIn: quoteParcel.lengthIn,
        widthIn: quoteParcel.widthIn,
        heightIn: quoteParcel.heightIn,
        estimatedBox: Boolean(quoteParcel.estimatedBox),
        boxId: quoteParcel.boxId ?? null,
        boxName: quoteParcel.boxName ?? null,
        unknownItemDimensions: Boolean(quoteParcel.unknownItemDimensions),
      }
      : {
        weightLb: quoteWeightLb,
        estimatedBox: usedEstimatedBox,
        parcels: packed.parcels.map((parcel) => ({
          weightLb: parcel.weightLb,
          lengthIn: parcel.lengthIn,
          widthIn: parcel.widthIn,
          heightIn: parcel.heightIn,
          estimatedBox: Boolean(parcel.estimatedBox),
          boxId: parcel.boxId ?? null,
          boxName: parcel.boxName ?? null,
          unknownItemDimensions: Boolean(parcel.unknownItemDimensions),
        })),
      },
    message: [
      usedEstimatedWeight ? "estimated_weight_used" : "verified_weight_used",
      usedEstimatedBox ? "estimated_box_used" : "measured_box_used",
    ].join("+"),
    status: "ok",
  });

  const allowedServices = parseAllowedServices(settings.shippo_allowed_services);
  const margin = Number(settings.shippo_margin_percent ?? 0);
  const cacheKey = `${provider}::${liveQuoteCacheKey({
    origin: input.origin,
    destination: input.destination,
    parcel: quoteParcel,
    parcels: packed.parcels,
    carriers: remaining,
    allowedServices,
    margin,
  })}`;
  const cached = readLiveQuoteCache(cacheKey);
  if (cached) return cached;

  if (packed.parcels.length > 1 && provider !== "easyship" && provider !== "shippo") {
    return {
      options: [],
      expectedLiveCarriers: remaining,
      message: "This cart needs more than one measured box. Multi-parcel quotes use Easyship or Shippo. Store Pickup remains available.",
    };
  }

  if (provider === "easypost") {
    const quoted = await quoteEasyPostShipment({
      origin: input.origin,
      destination: input.destination,
      parcel: quoteParcel,
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
          billableWeightLb: quoteWeightLb,
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
      weightLb: quoteWeightLb,
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

  if (provider === "easyship") {
    const quoted = await quoteEasyshipRates({
      origin: input.origin,
      destination: input.destination,
      parcels: packed.parcels.map((parcel) => ({
        weightLb: parcel.weightLb,
        lengthIn: parcel.lengthIn,
        widthIn: parcel.widthIn,
        heightIn: parcel.heightIn,
        items: easyshipQuoteItems(parcel.items),
      })),
      products: input.products,
      allowedServices,
    });
    if (!quoted.ok) {
      await recordShippingMonitorEvent("quote_failure", {
        reason: quoted.rateLimited ? "easyship_rate_limited" : quoted.code,
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
        message: quoted.error || easyshipQuoteErrorMessage("request_failed"),
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
            easyship.isSandbox || rate.test ? "Easyship sandbox rate — not a production quote" : "Easyship carrier rate",
          ].filter(Boolean).join(" · "),
          mode: "api" as const,
          zone: international ? "international" as const : "domestic" as const,
          rateMode: "live_api" as const,
          billableWeightLb: quoteWeightLb,
          easyshipRateId: rate.objectId,
          quoteSource: "easyship" as const,
          testRate: easyship.isSandbox || rate.test,
          etaDays: rate.estimatedDays,
        };
      }));
    await recordShippingMonitorEvent("checkout_quote", {
      provider: "easyship",
      rates: options.length,
      upsRates: options.filter((option) => option.provider === "ups").length,
      uspsRates: options.filter((option) => option.provider === "usps").length,
      test: easyship.isSandbox,
      country: String(input.destination.country || "").slice(0, 2).toUpperCase(),
      weightLb: quoteWeightLb,
    });
    if (!options.length) {
      return {
        options: [],
        expectedLiveCarriers: remaining,
        message: `Easyship returned no eligible ${remaining.map((carrier) => carrier.toUpperCase()).join(" and ")} services for this destination and parcel. No substitute rate was invented.`,
      };
    }
    const missingCarriers = remaining.filter((carrier) => !options.some((option) => option.provider === carrier));
    const success = {
      options,
      expectedLiveCarriers: remaining,
      message: missingCarriers.length
        ? `${missingCarriers.map((carrier) => carrier.toUpperCase()).join(" and ")} did not return a rate for this destination and parcel. Showing available Easyship rates only.`
        : undefined,
    };
    writeLiveQuoteCache(cacheKey, success);
    return success;
  }

  const accounts = await listShippoCarrierAccounts();
  const shippoQuote = {
    origin: input.origin,
    destination: input.destination,
    parcel: quoteParcel,
    parcels: packed.parcels,
    allowedServices,
  };
  let quoted = await quoteShippoShipment(shippoQuote);
  // Bounded single backoff for Shippo 10429 — never loop. Callers must not spam Shippo after a selection.
  const hitRateLimit = (!quoted.ok && Boolean(quoted.rateLimited))
    || (quoted.carrierMessages ?? []).some(isShippoRateLimitMessage);
  if (hitRateLimit) {
    const missingAfterLimit = remaining.filter((carrier) => !quoted.rates.some((rate) => rate.provider === carrier));
    if (missingAfterLimit.length || !quoted.ok) {
      await new Promise((resolve) => setTimeout(resolve, 1600));
      const retry = await quoteShippoShipment(shippoQuote);
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
        billableWeightLb: quoteWeightLb,
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
    weightLb: quoteWeightLb,
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
      const connected = carrier === "ups" ? accounts.ups : accounts.usps;
      if (connected === 0) return false;
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
    const apiHint = missingCarriers.includes("ups") && upsMessages.length
      ? ` Shippo UPS note: ${upsMessages[0]}`
      : missingCarriers.includes("usps") && uspsMessages.length
        ? ` Shippo USPS note: ${uspsMessages[0]}`
        : "";
    const diagnosis = shippoMissingCarrierMessage({
      missing: missingCarriers,
      upsAccounts: accounts.ups,
      uspsAccounts: accounts.usps,
    });
    const result = {
      options,
      expectedLiveCarriers: remaining,
      message: `${diagnosis}${apiHint} Showing available ${present} ${shippo.isTest ? "TEST" : "LIVE"} rates only. This is a carrier/API quote result, not a disabled setting.`,
    };
    writeLiveQuoteCache(cacheKey, result);
    return result;
  }
  const success = { options, expectedLiveCarriers: remaining };
  writeLiveQuoteCache(cacheKey, success);
  return success;
}
