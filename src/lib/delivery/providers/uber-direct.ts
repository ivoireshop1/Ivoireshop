import { createHmac, timingSafeEqual } from "node:crypto";
import type { DeliveryOption } from "../types";

export type UberEnvironment = "sandbox" | "production" | "unidentified";
export const UBER_DIRECT_PRODUCTION_DISPATCH_FLAG = "founder-approved";

export function uberDirectCredentials(env: NodeJS.ProcessEnv = process.env) {
  const customerId = envText(env, "UBER_DIRECT_CUSTOMER_ID");
  const clientId = envText(env, "UBER_DIRECT_CLIENT_ID");
  const clientSecret = envText(env, "UBER_DIRECT_CLIENT_SECRET");
  const webhookSigningKey = envText(env, "UBER_DIRECT_WEBHOOK_SIGNING_KEY");
  const environment = uberDirectEnvironment(env);
  return {
    configured: Boolean(customerId && clientId && clientSecret),
    customerId,
    clientId,
    clientSecret,
    webhookSigningKey,
    environment,
    productionDispatchEnabled: envText(env, "UBER_DIRECT_PRODUCTION_DISPATCH") === UBER_DIRECT_PRODUCTION_DISPATCH_FLAG,
  };
}

export function uberDirectEnvironment(env: NodeJS.ProcessEnv = process.env): UberEnvironment {
  const value = envText(env, "UBER_DIRECT_ENVIRONMENT").toLowerCase();
  if (value === "sandbox" || value === "production") return value;
  return "unidentified";
}

export function uberDispatchAllowed(env: NodeJS.ProcessEnv = process.env) {
  const creds = uberDirectCredentials(env);
  if (!creds.configured || creds.environment === "unidentified") return false;
  if (creds.environment === "sandbox") return true;
  return creds.productionDispatchEnabled;
}

function envText(env: NodeJS.ProcessEnv, name: string) {
  return String(env[name] ?? "").trim();
}

const AUTH_URL = "https://auth.uber.com/oauth/v2/token";
const SCOPE = "eats.deliveries";
const TOKEN_SKEW_MS = 60_000;

type TokenCache = { key: string; token: string; expiresAt: number };
let tokenCache: TokenCache | null = null;
let tokenRequest: { key: string; promise: Promise<string> } | null = null;

export type UberAddress = {
  street_address: string[];
  city: string;
  state: string;
  zip_code: string;
  country: string;
};

export type UberQuote = {
  id: string;
  feeCents: number;
  currency: string;
  expiresAt: string | null;
  dropoffEta: string | null;
  durationSeconds: number | null;
};

export function clearUberTokenCache() {
  tokenCache = null;
  tokenRequest = null;
}

export function uberApiHost(environment: UberEnvironment) {
  if (environment === "sandbox") return "https://sandbox-api.uber.com";
  if (environment === "production") return "https://api.uber.com";
  return null;
}

export function formatUberAddress(input: {
  address_line_1?: string | null;
  address_line_2?: string | null;
  city?: string | null;
  state?: string | null;
  postal_code?: string | null;
  country?: string | null;
}): UberAddress | null {
  const line1 = String(input.address_line_1 ?? "").trim();
  const city = String(input.city ?? "").trim();
  const state = String(input.state ?? "").trim();
  const zip = String(input.postal_code ?? "").trim();
  const country = String(input.country ?? "").trim().toUpperCase();
  const domestic = country === "US" || country === "USA" || country === "UNITED STATES" || country === "UNITED STATES OF AMERICA";
  if (!line1 || !city || !state || !zip || !domestic) return null;
  const line2 = String(input.address_line_2 ?? "").trim();
  return {
    street_address: line2 ? [line1, line2] : [line1],
    city,
    state,
    zip_code: zip,
    country: "US",
  };
}

export function verifyUberWebhookSignature(rawBody: string, signature: string | null, signingKey: string) {
  const provided = String(signature ?? "").trim().toLowerCase();
  if (!provided || !signingKey) return false;
  const expected = createHmac("sha256", signingKey).update(rawBody).digest("hex");
  const left = Buffer.from(provided);
  const right = Buffer.from(expected);
  if (left.length !== right.length) return false;
  return timingSafeEqual(left, right);
}

export async function getUberAccessToken(input: {
  fetchImpl?: typeof fetch;
  now?: number;
  env?: NodeJS.ProcessEnv;
} = {}) {
  const env = input.env ?? process.env;
  const creds = uberDirectCredentials(env);
  if (!creds.configured) throw new Error("Uber Direct is not configured.");
  if (creds.environment === "unidentified") throw new Error("Uber Direct environment is not identified.");
  const key = `${creds.environment}:${creds.clientId}`;
  const now = input.now ?? Date.now();
  if (tokenCache && tokenCache.key === key && tokenCache.expiresAt - TOKEN_SKEW_MS > now) return tokenCache.token;
  if (tokenRequest?.key === key) return tokenRequest.promise;
  const promise = requestUberToken(creds, input.fetchImpl ?? fetch, now);
  tokenRequest = { key, promise };
  try {
    const token = await promise;
    return token;
  } finally {
    if (tokenRequest?.promise === promise) tokenRequest = null;
  }
}

async function requestUberToken(
  creds: ReturnType<typeof uberDirectCredentials>,
  fetchImpl: typeof fetch,
  now: number,
) {
  const body = new URLSearchParams({
    client_id: creds.clientId,
    client_secret: creds.clientSecret,
    grant_type: "client_credentials",
    scope: SCOPE,
  });
  const response = await fetchImpl(AUTH_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  const payload = await readJson(response);
  if (!response.ok) {
    throw new Error(uberErrorMessage(response.status, payload, "Uber Direct authentication failed."));
  }
  const token = String(payload.access_token ?? "");
  const expiresIn = Number(payload.expires_in);
  if (!token || !Number.isFinite(expiresIn) || expiresIn <= 0) throw new Error("Uber Direct did not return a usable access token.");
  tokenCache = { key: `${creds.environment}:${creds.clientId}`, token, expiresAt: now + expiresIn * 1000 };
  return token;
}

export async function quoteUberDelivery(input: {
  pickup: UberAddress;
  dropoff: UberAddress;
  markupCents?: number;
  fetchImpl?: typeof fetch;
  now?: number;
  env?: NodeJS.ProcessEnv;
}): Promise<{ option?: DeliveryOption; unavailable?: string }> {
  const env = input.env ?? process.env;
  const creds = uberDirectCredentials(env);
  if (!creds.configured || creds.environment === "unidentified" || !uberDispatchAllowed(env)) {
    return { unavailable: "Local delivery is not available right now." };
  }
  const host = uberApiHost(creds.environment);
  if (!host) return { unavailable: "Local delivery is not available right now." };
  try {
    const token = await getUberAccessToken({ fetchImpl: input.fetchImpl, now: input.now, env });
    const response = await (input.fetchImpl ?? fetch)(`${host}/v1/customers/${encodeURIComponent(creds.customerId)}/delivery_quotes`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        pickup_address: JSON.stringify(input.pickup),
        dropoff_address: JSON.stringify(input.dropoff),
      }),
    });
    const payload = await readJson(response);
    if (!response.ok) return { unavailable: uberErrorMessage(response.status, payload, "Uber could not quote this delivery.") };
    const feeCents = Number(payload.fee);
    const quoteId = String(payload.id ?? "");
    const expiresAt = payload.expires ? String(payload.expires) : null;
    const now = input.now ?? Date.now();
    if (!quoteId || !Number.isFinite(feeCents) || feeCents < 0) return { unavailable: "Uber did not return a delivery price." };
    if (expiresAt && Date.parse(expiresAt) <= now) return { unavailable: "The Uber delivery quote expired. Refresh the address to request a new one." };
    const markupCents = Math.max(0, Math.round(Number(input.markupCents ?? 0)));
    const dropoffEta = payload.dropoff_eta ? String(payload.dropoff_eta) : null;
    const duration = Number(payload.duration);
    return {
      option: {
        id: `uber:${quoteId}`,
        provider: "uber",
        fulfillmentMethod: "delivery",
        label: "Local Delivery — Powered by Uber",
        amount: Number(((feeCents + markupCents) / 100).toFixed(2)),
        serviceCode: "uber_direct",
        estimate: formatEta(dropoffEta, Number.isFinite(duration) ? duration : null),
        mode: "api",
        rateMode: "live_api",
        quoteSource: "uber",
        currency: String(payload.currency ?? "USD").toUpperCase() === "USD" ? "USD" : String(payload.currency ?? "USD"),
        testRate: creds.environment === "sandbox",
        uberQuoteId: quoteId,
        uberExpiresAt: expiresAt,
        uberFeeCents: feeCents,
        uberMarkupCents: markupCents,
        dropoffEta,
      },
    };
  } catch (error) {
    return { unavailable: (error instanceof Error ? error.message : "Uber quote failed.").replace(/Bearer\s+\S+/gi, "[redacted]").slice(0, 180) };
  }
}

export async function createUberDelivery(input: {
  quoteId: string;
  idempotencyKey: string;
  pickupName: string;
  pickupPhone: string;
  pickup: UberAddress;
  dropoffName: string;
  dropoffPhone: string;
  dropoff: UberAddress;
  manifestReference: string;
  manifestItems: Array<{ name: string; quantity: number }>;
  fetchImpl?: typeof fetch;
  env?: NodeJS.ProcessEnv;
}) {
  const env = input.env ?? process.env;
  if (!uberDispatchAllowed(env)) return { ok: false as const, error: "Uber courier dispatch is off." };
  const creds = uberDirectCredentials(env);
  const host = uberApiHost(creds.environment);
  if (!host) return { ok: false as const, error: "Uber Direct environment is not identified." };
  if (!input.quoteId) return { ok: false as const, error: "The Uber quote is missing." };
  const token = await getUberAccessToken({ fetchImpl: input.fetchImpl, env });
  const response = await (input.fetchImpl ?? fetch)(`${host}/v1/customers/${encodeURIComponent(creds.customerId)}/deliveries`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      "Idempotency-Key": input.idempotencyKey,
    },
    body: JSON.stringify({
      quote_id: input.quoteId,
      pickup_name: input.pickupName,
      pickup_address: JSON.stringify(input.pickup),
      pickup_phone_number: input.pickupPhone,
      dropoff_name: input.dropoffName,
      dropoff_address: JSON.stringify(input.dropoff),
      dropoff_phone_number: input.dropoffPhone,
      manifest_reference: input.manifestReference,
      manifest_items: input.manifestItems.map((item) => ({ name: item.name, quantity: item.quantity, size: "small" })),
      idempotency_key: input.idempotencyKey,
    }),
  });
  const payload = await readJson(response);
  if (!response.ok) return { ok: false as const, error: uberErrorMessage(response.status, payload, "Uber did not create the delivery.") };
  const deliveryId = String(payload.id ?? "");
  if (!deliveryId) return { ok: false as const, error: "Uber did not return a delivery id." };
  return { ok: true as const, delivery: normalizeUberDelivery(payload) };
}

export async function getUberDelivery(deliveryId: string, input: { fetchImpl?: typeof fetch; env?: NodeJS.ProcessEnv } = {}) {
  const env = input.env ?? process.env;
  const creds = uberDirectCredentials(env);
  const host = uberApiHost(creds.environment);
  if (!host || !creds.configured) return { ok: false as const, error: "Uber Direct is not configured." };
  const token = await getUberAccessToken({ fetchImpl: input.fetchImpl, env });
  const response = await (input.fetchImpl ?? fetch)(`${host}/v1/customers/${encodeURIComponent(creds.customerId)}/deliveries/${encodeURIComponent(deliveryId)}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const payload = await readJson(response);
  if (!response.ok) return { ok: false as const, error: uberErrorMessage(response.status, payload, "Uber delivery could not be retrieved.") };
  return { ok: true as const, delivery: normalizeUberDelivery(payload) };
}

export async function cancelUberDelivery(deliveryId: string, input: { fetchImpl?: typeof fetch; env?: NodeJS.ProcessEnv } = {}) {
  const env = input.env ?? process.env;
  if (!uberDispatchAllowed(env)) return { ok: false as const, error: "Uber courier dispatch is off." };
  const creds = uberDirectCredentials(env);
  const host = uberApiHost(creds.environment);
  if (!host) return { ok: false as const, error: "Uber Direct environment is not identified." };
  const token = await getUberAccessToken({ fetchImpl: input.fetchImpl, env });
  const response = await (input.fetchImpl ?? fetch)(`${host}/v1/customers/${encodeURIComponent(creds.customerId)}/deliveries/${encodeURIComponent(deliveryId)}/cancel`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({}),
  });
  const payload = await readJson(response);
  if (!response.ok) return { ok: false as const, error: uberErrorMessage(response.status, payload, "Uber did not cancel the delivery.") };
  return { ok: true as const, delivery: normalizeUberDelivery(payload) };
}

export function normalizeUberDelivery(payload: Record<string, unknown>) {
  const courier = payload.courier && typeof payload.courier === "object" ? payload.courier as Record<string, unknown> : null;
  return {
    id: String(payload.id ?? ""),
    status: String(payload.status ?? ""),
    trackingUrl: payload.tracking_url ? String(payload.tracking_url) : null,
    feeCents: Number.isFinite(Number(payload.fee)) ? Number(payload.fee) : null,
    currency: payload.currency ? String(payload.currency) : null,
    courierName: courier?.name ? String(courier.name) : null,
    courierPhone: courier?.phone_number ? String(courier.phone_number) : null,
    courierVehicle: courier?.vehicle_type ? String(courier.vehicle_type) : null,
    dropoffEta: payload.dropoff_eta ? String(payload.dropoff_eta) : null,
  };
}

export function uberErrorMessage(status: number, payload: Record<string, unknown>, fallback: string) {
  const code = String(payload.code ?? payload.error ?? "").toLowerCase();
  if (status === 408 || status === 504 || code.includes("timeout")) return "Uber did not respond in time. No courier was booked.";
  if (code.includes("expired")) return "The Uber delivery quote expired. No courier was booked.";
  if (code.includes("courier") || code.includes("unavailable")) return "No Uber courier is available for this delivery. No courier was booked.";
  if (code.includes("address") || status === 400 || status === 422) return "Uber could not use this address. No courier was booked.";
  return String(payload.message ?? fallback).replace(/Bearer\s+\S+/gi, "[redacted]").slice(0, 180);
}

function formatEta(dropoffEta: string | null, durationSeconds: number | null) {
  if (dropoffEta) {
    const time = Date.parse(dropoffEta);
    if (Number.isFinite(time)) return `Estimated delivery ${new Date(time).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}`;
  }
  if (durationSeconds != null && durationSeconds > 0) return `Estimated delivery in ${Math.max(1, Math.round(durationSeconds / 60))} min`;
  return "Estimated delivery time returned by Uber";
}

async function readJson(response: Response) {
  try {
    const payload = await response.json();
    return payload && typeof payload === "object" ? payload as Record<string, unknown> : {};
  } catch {
    return {};
  }
}
