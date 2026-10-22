/** Emergency checkout switch. Unset, false, 0, off, and no all mean OFF. */
export function shippingLiveRatesEnabled(env: NodeJS.ProcessEnv = process.env) {
  const raw = String(env.SHIPPING_LIVE_RATES_ENABLED ?? "").trim().toLowerCase();
  return raw === "1" || raw === "true" || raw === "on" || raw === "yes";
}

export const LIVE_RATES_DISABLED_MESSAGE =
  "Live UPS/USPS checkout rates are turned off. Store Pickup remains available.";
