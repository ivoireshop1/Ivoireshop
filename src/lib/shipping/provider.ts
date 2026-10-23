export type ShippingProvider = "shippo" | "easypost" | "easyship";

export function parseShippingProvider(value: unknown): ShippingProvider {
  if (value === "easypost") return "easypost";
  if (value === "easyship") return "easyship";
  return "shippo";
}

export function shippingProviderLabel(provider: ShippingProvider) {
  if (provider === "easypost") return "EasyPost";
  if (provider === "easyship") return "Easyship";
  return "Shippo";
}

export function carrierUnavailableCopy(carrier: "ups" | "usps", provider: ShippingProvider) {
  const name = shippingProviderLabel(provider);
  if (carrier === "ups") {
    return `UPS is unavailable for this destination and parcel. ${name} did not return a UPS rate. USPS and store options below are still available when listed.`;
  }
  return `USPS is unavailable for this destination and parcel. ${name} did not return a USPS rate.`;
}

/** Live UPS/USPS API quotes are requested only when the selected provider is enabled. */
export function liveCarrierApiEnabled(settings: Record<string, unknown> | null | undefined): boolean {
  const row = settings ?? {};
  const provider = parseShippingProvider(row.shipping_provider);
  if (provider === "easypost") return row.easypost_enabled === true;
  if (provider === "easyship") return row.easyship_enabled === true;
  return row.shippo_enabled === true;
}

export function customerFacingEasyPostAllowed(input: {
  provider: ShippingProvider;
  isTest: boolean;
  customerRatesEnabled: boolean;
}) {
  if (input.provider !== "easypost") return false;
  if (input.isTest) return true;
  return input.customerRatesEnabled === true;
}

export function customerFacingEasyShipAllowed(input: {
  provider: ShippingProvider;
  isSandbox: boolean;
  customerRatesEnabled: boolean;
}) {
  if (input.provider !== "easyship") return false;
  if (input.isSandbox) return true;
  return input.customerRatesEnabled === true;
}

/** TEST Shippo rates never become customer checkout prices. LIVE quotes stay off until founder enables them. */
export function customerFacingShippoAllowed(input: {
  provider: ShippingProvider;
  isTest: boolean;
  isLive: boolean;
  customerRatesEnabled: boolean;
}) {
  if (input.provider !== "shippo") return false;
  if (input.isTest) return false;
  if (!input.isLive) return false;
  return input.customerRatesEnabled === true;
}
