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
  rateMode?: "store_rate" | "manual_quote" | "live_api" | "rate_table";
  usedFallback?: boolean;
  billableWeightLb?: number;
  shippoRateId?: string | null;
  easypostRateId?: string | null;
  easypostShipmentId?: string | null;
  easyshipRateId?: string | null;
  quoteSource?: "shippo" | "easypost" | "easyship" | "rate_table";
  currency?: string;
  testRate?: boolean;
  etaDays?: number | null;
  parcelEstimate?: {
    counted: number;
    totalWeightLb: number;
    estimatedBox: boolean;
    parcels: Array<{
      boxId: string | null;
      boxName: string | null;
      estimatedBox: boolean;
      weightLb: number;
      lengthIn: number;
      widthIn: number;
      heightIn: number;
      unknownItemDimensions: boolean;
      items: string[];
    }>;
  };
};

export function sanitizeProviderError(raw: string) {
  return raw
    .replace(/Bearer\s+\S+/gi, "[redacted]")
    .replace(/Basic\s+\S+/gi, "[redacted]")
    .replace(/\b(?:sand|prod)_[A-Za-z0-9+/=]+/g, "[redacted]")
    .slice(0, 180);
}
