import type { DeliveryOption } from "./types";
import type { PickupLocationSnapshot } from "./origin";

export function optionToSnapshot(option: DeliveryOption, pickupLocation?: PickupLocationSnapshot | null) {
  return {
    provider: option.provider,
    service: option.serviceCode || option.label,
    amount: option.amount,
    estimate: option.estimate || null,
    mode: option.mode || (option.provider === "ups" || option.provider === "usps" ? "manual" : null),
    zone: option.zone || null,
    source: option.provider === "ivoire" ? "ivoire_engine" : option.mode || null,
    used_fallback: option.usedFallback === true,
    billable_weight_lb: option.billableWeightLb ?? null,
    quoted_at: new Date().toISOString(),
    ...(option.provider === "pickup" && pickupLocation ? { pickup_location: pickupLocation } : {}),
  };
}
