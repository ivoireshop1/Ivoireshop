export type DeliveryOption = {
  id: string;
  provider: "pickup" | "store" | "doordash" | "ups" | "usps" | "ivoire";
  fulfillmentMethod: "delivery" | "local_pickup";
  label: string;
  amount: number;
  serviceCode?: string;
  serviceToken?: string;
  estimate?: string;
  mode?: "manual" | "api";
  zone?: "domestic" | "international";
  rateMode?: "store_rate" | "manual_quote" | "live_api";
  usedFallback?: boolean;
  billableWeightLb?: number;
  shippoRateId?: string | null;
  easypostRateId?: string | null;
  easypostShipmentId?: string | null;
  quoteSource?: "shippo" | "easypost";
  testRate?: boolean;
  etaDays?: number | null;
};

export function sanitizeProviderError(raw: string) {
  return raw
    .replace(/Bearer\s+\S+/gi, "[redacted]")
    .replace(/Basic\s+\S+/gi, "[redacted]")
    .slice(0, 180);
}
