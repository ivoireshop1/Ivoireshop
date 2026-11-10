export type LiveRatesSwitch = "on" | "off" | "unset";

/** Emergency checkout switch. Only an explicit on value is "on". Blank is unset. Everything else is off. */
export function shippingLiveRatesSwitch(env: NodeJS.ProcessEnv = process.env): LiveRatesSwitch {
  const raw = String(env.SHIPPING_LIVE_RATES_ENABLED ?? "").trim().toLowerCase();
  if (raw === "1" || raw === "true" || raw === "on" || raw === "yes") return "on";
  if (!raw) return "unset";
  return "off";
}

export function shippingLiveRatesEnabled(env: NodeJS.ProcessEnv = process.env) {
  return shippingLiveRatesSwitch(env) === "on";
}

/** Saved Admin activation for the selected live provider. Shippo still requires the explicit environment switch. */
export function adminCustomerRatesActivated(settings: Record<string, unknown> | null | undefined) {
  const row = settings ?? {};
  if (row.shipping_provider === "easyship") {
    return row.easyship_enabled === true && row.easyship_customer_rates_enabled === true;
  }
  if (row.shipping_provider === "easypost") {
    return row.easypost_enabled === true && row.easypost_customer_rates_enabled === true;
  }
  return false;
}

/**
 * Explicit off stops every live quote. Unset follows the saved Easyship or EasyPost customer-rate activation.
 * Explicit on continues into the provider checks, including Shippo.
 */
export function checkoutLiveQuotesBlocked(
  settings: Record<string, unknown> | null | undefined,
  env: NodeJS.ProcessEnv = process.env,
) {
  const state = shippingLiveRatesSwitch(env);
  if (state === "off") return true;
  if (state === "on") return false;
  return !adminCustomerRatesActivated(settings);
}

export const LIVE_RATES_DISABLED_MESSAGE =
  "Live UPS/USPS checkout rates are turned off. Store Pickup remains available.";
