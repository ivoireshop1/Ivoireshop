import { uspsCredentials } from "../credentials";
import { sanitizeProviderError, type DeliveryOption } from "../types";
import type { StoreOrigin } from "../origin";
import type { PackageDims } from "../package";

async function uspsToken() {
  const creds = uspsCredentials();
  if (!creds.configured) return null;
  const response = await fetch("https://api.usps.com/oauth2/v3/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "client_credentials",
      client_id: creds.consumerKey,
      client_secret: creds.consumerSecret,
    }),
  });
  if (!response.ok) return null;
  const data = (await response.json()) as { access_token?: string };
  return data.access_token || null;
}

export async function verifyUsps(): Promise<{ ok: boolean; error?: string }> {
  const creds = uspsCredentials();
  if (!creds.configured) return { ok: false, error: "Not configured" };
  try {
    const token = await uspsToken();
    if (!token) return { ok: false, error: "Authentication failed" };
    return { ok: true };
  } catch (error) {
    return { ok: false, error: sanitizeProviderError(error instanceof Error ? error.message : "request failed") };
  }
}

export async function quoteUsps(input: {
  origin: StoreOrigin;
  destination: { postal_code?: string };
  pkg: PackageDims;
}): Promise<{ options: DeliveryOption[]; error?: string }> {
  const creds = uspsCredentials();
  if (!creds.configured) return { options: [] };
  try {
    const token = await uspsToken();
    if (!token) return { options: [], error: "Authentication failed" };
    const response = await fetch("https://api.usps.com/prices/v3/base-rates/search", {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        originZIPCode: input.origin.postal_code,
        destinationZIPCode: input.destination.postal_code,
        weight: Math.max(1, Math.ceil(input.pkg.weightLb)),
        length: Math.ceil(input.pkg.lengthIn),
        width: Math.ceil(input.pkg.widthIn),
        height: Math.ceil(input.pkg.heightIn),
        mailClass: "ALL",
        priceType: "RETAIL",
        mailingDate: new Date().toISOString().slice(0, 10),
      }),
    });
    if (!response.ok) return { options: [], error: `HTTP ${response.status}` };
    const data = (await response.json()) as { rateOptions?: Array<{ mailClass?: string; totalPrice?: number; description?: string }> };
    const options: DeliveryOption[] = [];
    for (const row of data.rateOptions ?? []) {
      const amount = Number(row.totalPrice ?? NaN);
      if (!Number.isFinite(amount) || amount < 0) continue;
      const name = row.description || row.mailClass || "USPS";
      options.push({
        id: `usps:${row.mailClass || name}`,
        provider: "usps",
        fulfillmentMethod: "delivery",
        label: `USPS — ${name}`,
        amount,
        serviceCode: row.mailClass || name,
      });
    }
    return { options };
  } catch (error) {
    return { options: [], error: sanitizeProviderError(error instanceof Error ? error.message : "request failed") };
  }
}
