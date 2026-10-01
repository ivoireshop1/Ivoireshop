import { upsCredentials } from "../credentials";
import { sanitizeProviderError, type DeliveryOption } from "../types";
import type { StoreOrigin } from "../origin";
import type { PackageDims } from "../package";

async function upsToken() {
  const creds = upsCredentials();
  if (!creds.configured) return null;
  const response = await fetch("https://onlinetools.ups.com/security/v1/oauth/token", {
    method: "POST",
    headers: {
      Authorization: `Basic ${Buffer.from(`${creds.clientId}:${creds.clientSecret}`).toString("base64")}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: "grant_type=client_credentials",
  });
  if (!response.ok) return null;
  const data = (await response.json()) as { access_token?: string };
  return data.access_token || null;
}

export async function verifyUps(): Promise<{ ok: boolean; error?: string }> {
  const creds = upsCredentials();
  if (!creds.configured) return { ok: false, error: "Not configured" };
  try {
    const token = await upsToken();
    if (!token) return { ok: false, error: "Authentication failed" };
    return { ok: true };
  } catch (error) {
    return { ok: false, error: sanitizeProviderError(error instanceof Error ? error.message : "request failed") };
  }
}

export async function quoteUps(input: {
  origin: StoreOrigin;
  destination: { address_line_1?: string; city?: string; state?: string; postal_code?: string; country?: string };
  pkg: PackageDims;
}): Promise<{ options: DeliveryOption[]; error?: string }> {
  const creds = upsCredentials();
  if (!creds.configured) return { options: [] };
  try {
    const token = await upsToken();
    if (!token) return { options: [], error: "Authentication failed" };
    const response = await fetch("https://onlinetools.ups.com/api/rating/v1/Shop", {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        RateRequest: {
          Request: { RequestOption: "Shop" },
          Shipment: {
            Shipper: {
              ShipperNumber: creds.accountNumber || undefined,
              Address: {
                AddressLine: [input.origin.address_line_1],
                City: input.origin.city,
                StateProvinceCode: input.origin.state,
                PostalCode: input.origin.postal_code,
                CountryCode: input.origin.country || "US",
              },
            },
            ShipTo: {
              Address: {
                AddressLine: [input.destination.address_line_1],
                City: input.destination.city,
                StateProvinceCode: input.destination.state,
                PostalCode: input.destination.postal_code,
                CountryCode: input.destination.country || "US",
              },
            },
            Package: {
              PackagingType: { Code: "02" },
              Dimensions: {
                UnitOfMeasurement: { Code: "IN" },
                Length: String(Math.ceil(input.pkg.lengthIn)),
                Width: String(Math.ceil(input.pkg.widthIn)),
                Height: String(Math.ceil(input.pkg.heightIn)),
              },
              PackageWeight: {
                UnitOfMeasurement: { Code: "LBS" },
                Weight: String(Math.max(1, Math.ceil(input.pkg.weightLb))),
              },
            },
          },
        },
      }),
    });
    if (!response.ok) return { options: [], error: `HTTP ${response.status}` };
    const data = (await response.json()) as {
      RateResponse?: { RatedShipment?: Array<{ Service?: { Code?: string; Description?: string }; TotalCharges?: { MonetaryValue?: string }; TimeInTransit?: { ServiceSummary?: { EstimatedArrival?: { Arrival?: { Date?: string } } } } }> };
    };
    const options: DeliveryOption[] = [];
    for (const row of data.RateResponse?.RatedShipment ?? []) {
      const amount = Number(row.TotalCharges?.MonetaryValue ?? NaN);
      if (!Number.isFinite(amount) || amount < 0) continue;
      const code = row.Service?.Code || "ups";
      const name = row.Service?.Description || `UPS ${code}`;
      options.push({
        id: `ups:${code}`,
        provider: "ups",
        fulfillmentMethod: "delivery",
        label: `UPS — ${name}`,
        amount,
        serviceCode: code,
      });
    }
    return { options };
  } catch (error) {
    return { options: [], error: sanitizeProviderError(error instanceof Error ? error.message : "request failed") };
  }
}
