export type ShippingProvider = "shippo" | "easypost";

export function parseShippingProvider(value: unknown): ShippingProvider {
  return value === "easypost" ? "easypost" : "shippo";
}

/** Live UPS/USPS API quotes are requested only when the selected provider is enabled. */
export function liveCarrierApiEnabled(settings: Record<string, unknown> | null | undefined): boolean {
  const row = settings ?? {};
  return parseShippingProvider(row.shipping_provider) === "easypost"
    ? row.easypost_enabled === true
    : row.shippo_enabled === true;
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
