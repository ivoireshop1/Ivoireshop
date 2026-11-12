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
    shippo_rate_id: option.shippoRateId ?? null,
    easypost_rate_id: option.easypostRateId ?? null,
    easypost_shipment_id: option.easypostShipmentId ?? null,
    easyship_rate_id: option.easyshipRateId ?? null,
    uber_quote_id: option.uberQuoteId ?? null,
    uber_expires_at: option.uberExpiresAt ?? null,
    uber_fee_cents: option.uberFeeCents ?? null,
    uber_markup_cents: option.uberMarkupCents ?? null,
    dropoff_eta: option.dropoffEta ?? null,
    quote_source: option.quoteSource ?? (option.shippoRateId ? "shippo" : option.easypostRateId ? "easypost" : option.easyshipRateId ? "easyship" : option.rateMode === "rate_table" ? "rate_table" : null),
    quote_id: option.id,
    service_token: option.serviceToken || option.serviceCode || null,
    currency: option.currency || "USD",
    store_calculated: option.rateMode === "rate_table",
    test_rate: option.testRate === true,
    eta_days: option.etaDays ?? null,
    quoted_at: new Date().toISOString(),
    parcel_estimate: option.parcelEstimate ?? null,
    ...(option.provider === "pickup" && pickupLocation ? { pickup_location: pickupLocation } : {}),
  };
}
