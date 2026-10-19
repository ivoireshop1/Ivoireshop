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
  listShippoCarrierAccounts,
  liveOptionId,
  parseAllowedServices,
  parseCountryList,
  quoteShippoShipment,
  shippoCredentials,
} from "./shippo";
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

function isShippoRateLimitMessage(text: string) {
  return /too many requests|10429|rate.?limit/i.test(text);
}

export async function quoteLiveCarrierOptions(input: {
  settings: Record<string, unknown> | null | undefined;
  origin: StoreOrigin;
  destination: { address_line_1?: string; city?: string; state?: string; postal_code?: string; country?: string };
  products: Parameters<typeof cartParcel>[0];
}): Promise<LiveQuoteResult> {
  const settings = input.settings ?? {};
  const shippoOn = settings.shippo_enabled === true;
  const liveCarriers = (["ups", "usps"] as const).filter((carrier) => {
    return shippoOn
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

  const creds = shippoCredentials();
  if (!creds.configured) {
    await recordShippingMonitorEvent("quote_failure", { reason: "not_configured", carriers: remaining });
    return {
      options: [],
      expectedLiveCarriers: remaining,
      message: "Live UPS/USPS quotes are enabled, but Shippo is not configured on this environment.",
    };
  }
  if (creds.isLive) {
    await recordShippingMonitorEvent("quote_failure", { reason: "live_token_blocked" });
    return {
      options: [],
      expectedLiveCarriers: remaining,
      message: "A live Shippo token is present. Checkout will not request live postage quotes until the founder approves production shipping.",
    };
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

  const accounts = await listShippoCarrierAccounts();
  const allowedServices = parseAllowedServices(settings.shippo_allowed_services);
  let quoted = await quoteShippoShipment({
    origin: input.origin,
    destination: input.destination,
    parcel: packed.parcel,
    allowedServices,
  });
  // Bounded single backoff for Shippo 10429 — never loop. Callers must not spam Shippo after a selection.
  if (quoted.ok && (quoted.carrierMessages ?? []).some(isShippoRateLimitMessage)) {
    const missingAfterLimit = remaining.filter((carrier) => !quoted.rates.some((rate) => rate.provider === carrier));
    if (missingAfterLimit.length) {
      await new Promise((resolve) => setTimeout(resolve, 1600));
      const retry = await quoteShippoShipment({
        origin: input.origin,
        destination: input.destination,
        parcel: packed.parcel,
        allowedServices,
      });
      if (retry.ok) {
        const retryCoversMore = missingAfterLimit.some((carrier) => retry.rates.some((rate) => rate.provider === carrier));
        if (retryCoversMore || retry.rates.length > quoted.rates.length) quoted = retry;
      }
    }
  }
  if (!quoted.ok) {
    await recordShippingMonitorEvent("quote_failure", {
      reason: "shippo_error",
      carriers: remaining,
      upsAccounts: accounts.ups,
      uspsAccounts: accounts.usps,
    });
    return {
      options: [],
      expectedLiveCarriers: remaining,
      message: "Shippo could not return UPS/USPS rates for this destination. The checkout did not substitute a manual estimate.",
    };
  }

  const margin = Number(settings.shippo_margin_percent ?? 0);
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
          creds.isTest || rate.test ? "Shippo test rate — not a production quote" : "Shippo carrier rate",
        ].filter(Boolean).join(" · "),
        mode: "api" as const,
        zone: international ? "international" as const : "domestic" as const,
        rateMode: "live_api" as const,
        billableWeightLb: packed.parcel!.weightLb,
        shippoRateId: rate.objectId,
        testRate: creds.isTest || rate.test,
        etaDays: rate.estimatedDays,
      };
    }));

  const upsRates = options.filter((option) => option.provider === "ups").length;
  const uspsRates = options.filter((option) => option.provider === "usps").length;
  await recordShippingMonitorEvent("checkout_quote", {
    rates: options.length,
    upsRates,
    uspsRates,
    upsAccounts: accounts.ups,
    uspsAccounts: accounts.usps,
    test: creds.isTest,
    country: String(input.destination.country || "").slice(0, 2).toUpperCase(),
    weightLb: packed.parcel.weightLb,
  });

  if (!options.length) {
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
    const upsMessages = (quoted.carrierMessages || []).filter((text) => text.startsWith("UPS"));
    const uspsMessages = (quoted.carrierMessages || []).filter((text) => text.startsWith("USPS"));
    const rateLimitedCarriers = missingCarriers.filter((carrier) => {
      const msgs = carrier === "ups" ? upsMessages : uspsMessages;
      return msgs.some(isShippoRateLimitMessage);
    });
    const temporaryBusy = rateLimitedCarriers.length > 0;
    if (temporaryBusy) {
      const busy = rateLimitedCarriers.map((carrier) => carrier.toUpperCase()).join(" and ");
      return {
        options,
        expectedLiveCarriers: remaining,
        temporaryBusy: true,
        rateLimitedCarriers,
        message: `${busy} rates are temporarily busy (carrier API limit). Your selected ${busy} rate is kept when already chosen — wait a moment before refreshing rates.`,
      };
    }
    const missing = missingCarriers.map((carrier) => carrier.toUpperCase()).join(" and ");
    const apiHint = missingCarriers.includes("ups") && upsMessages.length
      ? ` Shippo UPS note: ${upsMessages[0]}`
      : missingCarriers.includes("usps") && uspsMessages.length
        ? ` Shippo USPS note: ${uspsMessages[0]}`
        : "";
    return {
      options,
      expectedLiveCarriers: remaining,
      message: `${missing} did not return a rate for this destination and parcel.${apiHint} Showing available ${present} test rates only. This is a carrier/API quote result, not a disabled setting.`,
    };
  }
  return { options, expectedLiveCarriers: remaining };
}
