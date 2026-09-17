export const FULFILLMENT_STORAGE_KEY = "IVOIRE_SHOP_FULFILLMENT";
export const FULFILLMENT_CHANGE_EVENT = "ivoire-shop-fulfillment";
export const FULFILLMENT_METHODS = ["delivery", "local_pickup"] as const;

export type FulfillmentMethod = (typeof FULFILLMENT_METHODS)[number];

export function isFulfillmentMethod(value: unknown): value is FulfillmentMethod {
  return value === "delivery" || value === "local_pickup";
}

export function loadFulfillmentMethod(): FulfillmentMethod {
  if (typeof window === "undefined") return "delivery";
  try {
    const stored = window.localStorage.getItem(FULFILLMENT_STORAGE_KEY);
    return isFulfillmentMethod(stored) ? stored : "delivery";
  } catch {
    return "delivery";
  }
}

export function saveFulfillmentMethod(method: FulfillmentMethod) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(FULFILLMENT_STORAGE_KEY, method);
    window.dispatchEvent(new Event(FULFILLMENT_CHANGE_EVENT));
  } catch {
    /* storage is optional */
  }
}

export function subscribeFulfillment(callback: () => void) {
  window.addEventListener("storage", callback);
  window.addEventListener(FULFILLMENT_CHANGE_EVENT, callback);
  return () => {
    window.removeEventListener("storage", callback);
    window.removeEventListener(FULFILLMENT_CHANGE_EVENT, callback);
  };
}

export function fulfillmentLabel(method: string) {
  return method === "local_pickup" ? "Pickup" : "Delivery";
}
