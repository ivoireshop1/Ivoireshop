import { sanitizeProviderError } from "../delivery/types.ts";

function text(name: string) {
  return (process.env[name] ?? "").trim();
}

const EASYSHIP_RATES_PATH = "/2024-09/rates";
const SANDBOX_HOST = "https://public-api-sandbox.easyship.com";
const PRODUCTION_HOST = "https://public-api.easyship.com";

export type EasyshipKeyMode = "sandbox" | "production" | "unknown";
export type EasyshipQuoteErrorCode =
  | "not_configured"
  | "unrecognized_key"
  | "missing_scope"
  | "unauthorized"
  | "invalid_parcel"
  | "missing_declared_value"
  | "incomplete_address"
  | "rate_limited"
  | "request_failed";

export function easyshipKeysRotated(env: NodeJS.ProcessEnv = process.env) {
  const raw = String(env.EASYSHIP_KEYS_ROTATED ?? "").trim().toLowerCase();
  return raw === "1" || raw === "true" || raw === "on" || raw === "yes";
}

export function easyshipCredentials() {
  const key = text("EASYSHIP_API_KEY");
  const mode: EasyshipKeyMode | null = key.startsWith("sand_")
    ? "sandbox"
    : key.startsWith("prod_")
      ? "production"
      : key
        ? "unknown"
        : null;
  return {
    configured: Boolean(key),
    key,
    mode,
    isSandbox: mode === "sandbox",
    isProduction: mode === "production",
    host: mode === "sandbox" ? SANDBOX_HOST : PRODUCTION_HOST,
    keyLast4: key ? key.slice(-4) : null,
    keysRotated: easyshipKeysRotated(),
  };
}

export function easyshipPublicStatus() {
  const creds = easyshipCredentials();
  return {
    configured: creds.configured,
    mode: creds.mode,
    isSandbox: creds.isSandbox,
    isProduction: creds.isProduction,
    keyLast4: creds.keyLast4,
    keysRotated: creds.keysRotated,
    rotationRequired: creds.configured && !creds.keysRotated,
  };
}

export type EasyshipRate = {
  objectId: string;
  provider: "ups" | "usps";
  service: string;
  serviceToken: string;
  amount: number;
  currency: string;
  estimatedDays: number | null;
  durationTerms: string | null;
  test: boolean;
};

type EasyshipAddress = {
  name?: string;
  address_line_1?: string;
  address_line_2?: string;
  city?: string;
  state?: string;
  postal_code?: string;
  country?: string;
  phone?: string;
};

export type EasyshipParcel = {
  weightLb: number;
  lengthIn: number;
  widthIn: number;
  heightIn: number;
  items?: ReturnType<typeof easyshipQuoteItems>;
};

export type EasyshipQuoteItem = {
  quantity: number;
  price?: number | string | null;
  description?: string | null;
};

function countryAlpha2(country?: string) {
  const value = (country || "US").trim().toUpperCase();
  if (value === "USA" || value === "UNITED STATES" || value === "UNITED STATES OF AMERICA") return "US";
  return value.slice(0, 2);
}

function needsCityState(country: string) {
  return country === "US" || country === "CA" || country === "MX" || country === "AU";
}

function parcelIsValid(parcel: EasyshipParcel) {
  return parcel.weightLb > 0 && parcel.lengthIn > 0 && parcel.widthIn > 0 && parcel.heightIn > 0;
}

function unitPrice(value: unknown) {
  const amount = Number(value);
  return Number.isFinite(amount) && amount > 0 ? Number(amount.toFixed(2)) : null;
}

export function easyshipQuoteItems(products: EasyshipQuoteItem[]) {
  const items = [];
  for (const product of products) {
    const quantity = Number.isFinite(product.quantity) && product.quantity > 0 ? Math.min(Math.ceil(product.quantity), 50) : 0;
    const price = unitPrice(product.price);
    if (!quantity || price == null) continue;
    const description = String(product.description ?? "").trim().slice(0, 200) || "Ivoire Shop grocery item";
    items.push({
      description,
      quantity,
      declared_currency: "USD" as const,
      declared_customs_value: price,
    });
  }
  return items;
}

export function identifyEasyshipProvider(carrier: unknown): "ups" | "usps" | null {
  const token = String(carrier ?? "").trim().toLowerCase();
  if (!token) return null;
  if (token === "usps" || token.includes("usps")) return "usps";
  if (token === "ups" || token.includes("ups")) return "ups";
  return null;
}

export function classifyEasyshipHttpStatus(status: number, body: unknown): EasyshipQuoteErrorCode {
  if (status === 429) return "rate_limited";
  if (status === 401) return "unauthorized";
  const textValue = JSON.stringify(body ?? "").toLowerCase();
  if (status === 403 || textValue.includes("scope") || textValue.includes("forbidden")) return "missing_scope";
  return "request_failed";
}

export function easyshipApiMessage(body: unknown) {
  if (!body || typeof body !== "object") return "";
  const row = body as { error?: { message?: unknown }; message?: unknown; errors?: unknown };
  const firstError = Array.isArray(row.errors) ? row.errors[0] : null;
  const raw = [row.error?.message, row.message, firstError && typeof firstError === "object" && firstError && "message" in firstError ? firstError.message : firstError]
    .map((part) => String(part ?? "").trim())
    .find(Boolean);
  return raw ? sanitizeProviderError(raw) : "";
}

export function easyshipQuoteErrorMessage(code: EasyshipQuoteErrorCode) {
  switch (code) {
    case "not_configured":
      return "Live UPS/USPS quotes are enabled, but Easyship is not configured on this environment.";
    case "unrecognized_key":
      return "An Easyship key is present but the format is unrecognized. Expected a sand_ sandbox key or a prod_ production key.";
    case "missing_scope":
      return "Easyship rejected the rates request. Confirm the API connection includes the public.rate:read advanced scope. No substitute rate was invented.";
    case "unauthorized":
      return "Easyship did not accept the configured key. Confirm EASYSHIP_API_KEY on this environment. No substitute rate was invented.";
    case "invalid_parcel":
      return "Package weight and dimensions are required for UPS/USPS quotes. Missing product shipping data is never invented.";
    case "missing_declared_value":
      return "Easyship needs each item's selling price as the declared customs value. Missing prices are never invented.";
    case "incomplete_address":
      return "Easyship needs city and state on the origin and destination for UPS/USPS rates. No substitute rate was invented.";
    case "rate_limited":
      return "Easyship rates are temporarily busy. No substitute rate was invented.";
    default:
      return "Easyship could not return UPS/USPS rates for this destination. The checkout did not substitute a manual estimate.";
  }
}

export function easyshipAddressReady(origin: EasyshipAddress, destination: EasyshipAddress) {
  const originCountry = countryAlpha2(origin.country);
  const destCountry = countryAlpha2(destination.country);
  const originOk = Boolean(origin.city?.trim() && origin.postal_code?.trim() && originCountry);
  const destOk = Boolean(
    destination.address_line_1?.trim()
    && destination.city?.trim()
    && destination.postal_code?.trim()
    && destCountry,
  );
  if (!originOk || !destOk) return false;
  if (needsCityState(originCountry) && !origin.state?.trim()) return false;
  if (needsCityState(destCountry) && !destination.state?.trim()) return false;
  return true;
}

export function buildEasyshipRateRequest(input: {
  origin: EasyshipAddress;
  destination: EasyshipAddress;
  parcel?: EasyshipParcel;
  parcels?: Array<EasyshipParcel & { items?: ReturnType<typeof easyshipQuoteItems> }>;
  items: ReturnType<typeof easyshipQuoteItems>;
}) {
  const parcels = (input.parcels?.length ? input.parcels : input.parcel ? [input.parcel] : []).map((parcel, index) => {
    const parcelItems = "items" in parcel ? parcel.items : undefined;
    return {
      total_actual_weight: parcel.weightLb,
      box: {
        length: parcel.lengthIn,
        width: parcel.widthIn,
        height: parcel.heightIn,
      },
      items: Array.isArray(parcelItems) && parcelItems.length
        ? parcelItems
        : index === 0 ? input.items : input.items.slice(0, 1),
    };
  });
  return {
    origin_address: {
      line_1: input.origin.address_line_1 || "",
      line_2: input.origin.address_line_2 || "",
      city: input.origin.city || "",
      state: input.origin.state || "",
      postal_code: input.origin.postal_code || "",
      country_alpha2: countryAlpha2(input.origin.country),
      company_name: input.origin.name || "Ivoire Shop",
      contact_name: input.origin.name || "Ivoire Shop",
      contact_phone: input.origin.phone || "",
    },
    destination_address: {
      line_1: input.destination.address_line_1 || "",
      line_2: input.destination.address_line_2 || "",
      city: input.destination.city || "",
      state: input.destination.state || "",
      postal_code: input.destination.postal_code || "",
      country_alpha2: countryAlpha2(input.destination.country),
    },
    shipping_settings: {
      units: { weight: "lb" as const, dimensions: "in" as const },
      output_currency: "USD" as const,
    },
    calculate_tax_and_duties: false,
    parcels,
  };
}

export function mapEasyshipRates(body: unknown, allowedServices: string[] = [], test = false): EasyshipRate[] {
  if (!body || typeof body !== "object") return [];
  const payload = body as {
    rates?: Array<{
      courier_service?: { id?: string; name?: string; umbrella_name?: string } | null;
      total_charge?: number | string;
      currency?: string;
      min_delivery_time?: number | null;
      max_delivery_time?: number | null;
    }>;
  };
  const allowed = allowedServices.map((item) => item.toLowerCase());
  return (payload.rates ?? [])
    .map((row) => {
      const service = row.courier_service;
      const provider = identifyEasyshipProvider(service?.umbrella_name) ?? identifyEasyshipProvider(service?.name);
      const amount = Number(row.total_charge);
      const currency = String(row.currency || "").trim().toUpperCase();
      if (!provider || currency !== "USD" || !Number.isFinite(amount) || amount < 0) return null;
      const name = String(service?.name || service?.umbrella_name || "").trim();
      if (allowed.length && !allowed.some((token) => name.toLowerCase().includes(token))) return null;
      const days = row.min_delivery_time ?? row.max_delivery_time ?? null;
      return {
        objectId: String(service?.id || name),
        provider,
        service: name,
        serviceToken: name,
        amount,
        currency,
        estimatedDays: typeof days === "number" && Number.isFinite(days) ? days : null,
        durationTerms: typeof days === "number" && Number.isFinite(days)
          ? `${days} business day${days === 1 ? "" : "s"}`
          : null,
        test,
      } satisfies EasyshipRate;
    })
    .filter((row): row is EasyshipRate => Boolean(row));
}

async function postEasyshipRates(body: unknown) {
  const creds = easyshipCredentials();
  if (!creds.configured) return { ok: false as const, status: 0, body: null as unknown };
  const response = await fetch(`${creds.host}${EASYSHIP_RATES_PATH}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${creds.key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  const payload = await response.json().catch(() => null);
  return { ok: response.ok, status: response.status, body: payload };
}

export async function quoteEasyshipRates(input: {
  origin: EasyshipAddress;
  destination: EasyshipAddress;
  parcel?: EasyshipParcel;
  parcels?: Array<EasyshipParcel & { items?: ReturnType<typeof easyshipQuoteItems> }>;
  products: EasyshipQuoteItem[];
  allowedServices?: string[];
}) {
  const creds = easyshipCredentials();
  if (!creds.configured) {
    return { ok: false as const, error: easyshipQuoteErrorMessage("not_configured"), code: "not_configured" as const, rates: [] as EasyshipRate[], rateLimited: false, status: 0, apiMessage: "" };
  }
  if (creds.mode === "unknown") {
    return { ok: false as const, error: easyshipQuoteErrorMessage("unrecognized_key"), code: "unrecognized_key" as const, rates: [] as EasyshipRate[], rateLimited: false, status: 0, apiMessage: "" };
  }
  const parcels = input.parcels?.length ? input.parcels : input.parcel ? [input.parcel] : [];
  if (!parcels.length || parcels.some((parcel) => !parcelIsValid(parcel))) {
    return { ok: false as const, error: easyshipQuoteErrorMessage("invalid_parcel"), code: "invalid_parcel" as const, rates: [] as EasyshipRate[], rateLimited: false, status: 0, apiMessage: "" };
  }
  if (!easyshipAddressReady(input.origin, input.destination)) {
    return { ok: false as const, error: easyshipQuoteErrorMessage("incomplete_address"), code: "incomplete_address" as const, rates: [] as EasyshipRate[], rateLimited: false, status: 0, apiMessage: "" };
  }
  const items = easyshipQuoteItems(input.products);
  if (!items.length) {
    return { ok: false as const, error: easyshipQuoteErrorMessage("missing_declared_value"), code: "missing_declared_value" as const, rates: [] as EasyshipRate[], rateLimited: false, status: 0, apiMessage: "" };
  }

  const request = buildEasyshipRateRequest({
    origin: input.origin,
    destination: input.destination,
    parcels,
    items,
  });
  const result = await postEasyshipRates(request);
  if (!result.ok) {
    const code = classifyEasyshipHttpStatus(result.status, result.body);
    console.info("[easyship]", {
      operation: "rates",
      ok: false,
      status: result.status,
      code,
      host: creds.isSandbox ? "sandbox" : "production",
    });
    return {
      ok: false as const,
      error: easyshipQuoteErrorMessage(code),
      code,
      rates: [] as EasyshipRate[],
      rateLimited: code === "rate_limited",
      status: result.status,
      apiMessage: easyshipApiMessage(result.body),
    };
  }
  return {
    ok: true as const,
    rates: mapEasyshipRates(result.body, input.allowedServices ?? [], creds.isSandbox),
    test: creds.isSandbox,
    rateLimited: false,
    status: result.status,
    apiMessage: easyshipApiMessage(result.body),
  };
}
