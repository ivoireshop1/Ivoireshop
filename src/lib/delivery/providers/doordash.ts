import crypto from "node:crypto";
import { doordashCredentials } from "../credentials";
import { sanitizeProviderError, type DeliveryOption } from "../types";
import type { StoreOrigin } from "../origin";

function jwt() {
  const creds = doordashCredentials();
  const header = Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT", kid: creds.keyId })).toString("base64url");
  const now = Math.floor(Date.now() / 1000);
  const payload = Buffer.from(
    JSON.stringify({ aud: "doordash", iss: creds.developerId, kid: creds.keyId, iat: now, exp: now + 180 }),
  ).toString("base64url");
  const data = `${header}.${payload}`;
  const sig = crypto.createHmac("sha256", Buffer.from(creds.signingSecret, "base64")).update(data).digest("base64url");
  return `${data}.${sig}`;
}

export async function verifyDoorDash(): Promise<{ ok: boolean; error?: string }> {
  const creds = doordashCredentials();
  if (!creds.configured) return { ok: false, error: "Not configured" };
  try {
    const response = await fetch("https://openapi.doordash.com/drive/v2/stores", {
      headers: { Authorization: `Bearer ${jwt()}` },
    });
    if (response.status === 401 || response.status === 403) return { ok: false, error: "Authentication failed" };
    if (!response.ok && response.status !== 404) return { ok: false, error: `HTTP ${response.status}` };
    return { ok: true };
  } catch (error) {
    return { ok: false, error: sanitizeProviderError(error instanceof Error ? error.message : "request failed") };
  }
}

export async function quoteDoorDash(input: {
  origin: StoreOrigin;
  destination: { address_line_1?: string; city?: string; state?: string; postal_code?: string; country?: string };
}): Promise<{ options: DeliveryOption[]; error?: string }> {
  const creds = doordashCredentials();
  if (!creds.configured) return { options: [] };
  try {
    const response = await fetch("https://openapi.doordash.com/drive/v2/quotes", {
      method: "POST",
      headers: { Authorization: `Bearer ${jwt()}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        external_delivery_id: crypto.randomUUID(),
        pickup_address: {
          street: input.origin.address_line_1,
          city: input.origin.city,
          state: input.origin.state,
          zip_code: input.origin.postal_code,
        },
        dropoff_address: {
          street: input.destination.address_line_1,
          city: input.destination.city,
          state: input.destination.state,
          zip_code: input.destination.postal_code,
        },
      }),
    });
    if (!response.ok) return { options: [], error: `HTTP ${response.status}` };
    const data = (await response.json()) as {
      fee?: number;
      delivery_time?: number;
      pickup_time?: number;
    };
    const amount = Number(data.fee ?? 0) / 100;
    if (!Number.isFinite(amount) || amount < 0) return { options: [] };
    return {
      options: [
        {
          id: "doordash:standard",
          provider: "doordash",
          fulfillmentMethod: "delivery",
          label: "Local Delivery · DoorDash",
          amount,
          estimate: data.delivery_time ? `Dropoff window from provider` : undefined,
          serviceCode: "standard",
        },
      ],
    };
  } catch (error) {
    return { options: [], error: sanitizeProviderError(error instanceof Error ? error.message : "request failed") };
  }
}
