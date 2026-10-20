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
