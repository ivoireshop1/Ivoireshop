import type { DeliveryOption } from "./types";

/** Customer-facing Ivoire Shop store-calculated shipping is retired. */
export const IVOIRE_SHIPPING_RETIRED_MESSAGE =
  "Ivoire Shop Shipping is no longer available. Choose Store Pickup or a live UPS/USPS rate.";

export function isRetiredIvoireShippingSelection(selectedId: string | undefined) {
  const id = String(selectedId ?? "").trim().toLowerCase();
  return id === "ivoire" || id.startsWith("ivoire:");
}

/**
 * Carrier shipping at checkout must be live Shippo quotes.
 * Store/manual UPS/USPS amounts are never accepted for paid checkout.
 */
export function isCheckoutEligibleShippingOption(option: Pick<DeliveryOption, "provider" | "rateMode" | "fulfillmentMethod">) {
  if (option.provider === "ivoire") return false;
  if (option.fulfillmentMethod === "local_pickup" && option.provider === "pickup") return true;
  if (option.provider === "store") return true;
  if (option.provider === "ups" || option.provider === "usps") {
    return option.rateMode === "live_api";
  }
  if (option.provider === "doordash") return true;
  return false;
}
