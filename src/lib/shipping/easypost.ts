function text(name: string) {
  return (process.env[name] ?? "").trim();
}

export function easypostCredentials() {
  const key = text("EASYPOST_API_KEY");
  const mode = key.startsWith("EZTK") ? "test" : key.startsWith("EZAK") ? "live" : key ? "unknown" : null;
  return {
    configured: Boolean(key),
    key,
    mode,
    isTest: mode === "test",
    isLive: mode === "live",
  };
}

export type EasyPostRate = {
  objectId: string;
  shipmentId: string;
  provider: "ups" | "usps";
  service: string;
  serviceToken: string;
  amount: number;
  currency: string;
  estimatedDays: number | null;
  durationTerms: string | null;
  test: boolean;
};

type EasyPostAddress = {
  name?: string;
  address_line_1?: string;
  address_line_2?: string;
  city?: string;
  state?: string;
  postal_code?: string;
  country?: string;
  phone?: string;
};

function easypostAddress(address: EasyPostAddress) {
  const country = (address.country || "US").trim().toUpperCase();
  return {
    name: address.name || "Ivoire Shop",
    street1: address.address_line_1 || "",
    street2: address.address_line_2 || "",
    city: address.city || "",
    state: address.state || "",
    zip: address.postal_code || "",
    country: country === "USA" ? "US" : country.slice(0, 2),
    phone: address.phone || "",
  };
}

async function easypostRequest(path: string, init?: RequestInit) {
  const creds = easypostCredentials();
  if (!creds.configured) return { ok: false as const, status: 0, body: null as unknown };
  const response = await fetch(`https://api.easypost.com/v2${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${creds.key}`,
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });
  const body = await response.json().catch(() => null);
  return { ok: response.ok, status: response.status, body };
}

export function identifyEasyPostProvider(carrier: unknown): "ups" | "usps" | null {
  const token = String(carrier ?? "").trim().toLowerCase();
  if (!token) return null;
  if (token === "usps" || token.includes("usps")) return "usps";
  if (token === "ups" || token.includes("ups")) return "ups";
  return null;
}

export function mapEasyPostRates(
  body: unknown,
  allowedServices: string[] = [],
): EasyPostRate[] {
  if (!body || typeof body !== "object") return [];
  const shipment = body as {
    id?: string;
    mode?: string;
    rates?: Array<{
      id?: string;
      carrier?: string;
      service?: string;
      rate?: string;
      currency?: string;
      delivery_days?: number | null;
      est_delivery_days?: number | null;
    }>;
  };
  const shipmentId = String(shipment.id || "");
  const test = shipment.mode === "test";
  const allowed = allowedServices.map((item) => item.toLowerCase());
  return (shipment.rates ?? [])
    .map((row) => {
      const provider = identifyEasyPostProvider(row.carrier);
      const amount = Number(row.rate);
      if (!provider || !Number.isFinite(amount) || amount < 0) return null;
      const service = String(row.service || "").trim();
      if (allowed.length && !allowed.some((token) => service.toLowerCase().includes(token))) return null;
      const days = row.delivery_days ?? row.est_delivery_days ?? null;
      return {
        objectId: String(row.id || ""),
        shipmentId,
        provider,
        service,
        serviceToken: service,
        amount,
        currency: String(row.currency || "USD"),
        estimatedDays: typeof days === "number" && Number.isFinite(days) ? days : null,
        durationTerms: typeof days === "number" && Number.isFinite(days)
          ? `${days} business day${days === 1 ? "" : "s"}`
          : null,
        test,
      } satisfies EasyPostRate;
    })
    .filter((row): row is EasyPostRate => Boolean(row));
}

export async function quoteEasyPostShipment(input: {
  origin: EasyPostAddress;
  destination: EasyPostAddress;
  parcel: { weightLb: number; lengthIn: number; widthIn: number; heightIn: number };
  allowedServices?: string[];
}) {
  const creds = easypostCredentials();
  if (!creds.configured) return { ok: false as const, error: "EasyPost is not configured.", rates: [] as EasyPostRate[] };
  const ounces = Number((input.parcel.weightLb * 16).toFixed(2));
  const result = await easypostRequest("/shipments", {
    method: "POST",
    body: JSON.stringify({
      shipment: {
        from_address: easypostAddress(input.origin),
        to_address: easypostAddress(input.destination),
        parcel: {
          length: input.parcel.lengthIn,
          width: input.parcel.widthIn,
          height: input.parcel.heightIn,
          weight: ounces,
        },
      },
    }),
  });
  if (!result.ok) {
    const rateLimited = result.status === 429;
    console.info("[easypost]", {
      operation: "shipments",
      ok: false,
      status: result.status,
      rateLimited,
      message: rateLimited ? "rate_limited" : "request_failed",
    });
    return {
      ok: false as const,
      error: rateLimited
        ? "EasyPost rate limit. Retry shortly — no substitute rate was invented."
        : "EasyPost could not return rates.",
      rates: [] as EasyPostRate[],
      rateLimited,
      status: result.status,
    };
  }
  return {
    ok: true as const,
    shipmentId: result.body && typeof result.body === "object" ? String((result.body as { id?: string }).id || "") : "",
    rates: mapEasyPostRates(result.body, input.allowedServices ?? []),
    test: creds.isTest,
    rateLimited: false,
    status: result.status,
  };
}

