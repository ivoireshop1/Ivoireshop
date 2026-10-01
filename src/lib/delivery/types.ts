export type DeliveryOption = {
  id: string;
  provider: "pickup" | "store" | "doordash" | "ups" | "usps";
  fulfillmentMethod: "delivery" | "local_pickup";
  label: string;
  amount: number;
  serviceCode?: string;
  estimate?: string;
  mode?: "manual" | "api";
  zone?: "domestic" | "international";
};

export function sanitizeProviderError(raw: string) {
  return raw
    .replace(/Bearer\s+\S+/gi, "[redacted]")
    .replace(/Basic\s+\S+/gi, "[redacted]")
    .slice(0, 180);
}
