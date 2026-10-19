function text(name: string) {
  return (process.env[name] ?? "").trim();
}

export function shippoCredentials() {
  const token = text("SHIPPO_API_TOKEN");
  const mode = token.startsWith("shippo_test_") ? "test" : token.startsWith("shippo_live_") ? "live" : token ? "unknown" : null;
  return {
    configured: Boolean(token),
    token,
    mode,
    isTest: mode === "test",
    isLive: mode === "live",
  };
}

export function applyShippingMargin(amount: number, percent: number) {
  const safe = Number.isFinite(amount) && amount >= 0 ? amount : 0;
  const markup = Number.isFinite(percent) && percent > 0 ? percent : 0;
  return Number((safe * (1 + markup / 100)).toFixed(2));
}

export function parseCountryList(raw: unknown) {
  const textValue = Array.isArray(raw) ? raw.join(",") : String(raw ?? "");
  return textValue
    .split(/[\s,]+/)
    .map((item) => item.trim().toUpperCase())
    .filter((item) => item.length === 2);
}

export function internationalDestinationAllowed(country: string | null | undefined, allowlist: string[]) {
  const code = (country ?? "").trim().toUpperCase();
  if (!code || code === "US" || code === "USA") return true;
  if (!allowlist.length) return true;
  return allowlist.includes(code === "USA" ? "US" : code);
}

export function parseAllowedServices(raw: unknown) {
  if (Array.isArray(raw)) return raw.map((item) => String(item).trim()).filter(Boolean);
  const textValue = String(raw ?? "").trim();
  if (!textValue) return [];
  try {
    const parsed = JSON.parse(textValue);
    if (Array.isArray(parsed)) return parsed.map((item) => String(item).trim()).filter(Boolean);
  } catch {
    /* comma list */
  }
  return textValue.split(/[\n,]+/).map((item) => item.trim()).filter(Boolean);
}

export type ShippoRate = {
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

const CARRIER_MAP: Record<string, "ups" | "usps"> = {
  ups: "ups",
  usps: "usps",
};

/** Identify UPS/USPS from Shippo provider text. Check USPS before UPS so "usps" is never misread as UPS. */
export function identifyShippoProvider(provider: unknown, carrierAccount?: unknown): "ups" | "usps" | null {
  const token = String(provider ?? "").trim().toLowerCase();
  if (token) {
    if (CARRIER_MAP[token]) return CARRIER_MAP[token];
    if (token.includes("usps")) return "usps";
    if (/(^|[^a-z])ups([^a-z]|$)/i.test(token) || token === "ups" || token.startsWith("ups")) return "ups";
  }
  // carrier_account is usually a UUID — never treat it as a carrier name.
  const account = String(carrierAccount ?? "").trim().toLowerCase();
  if (account && !/^[a-f0-9]{32}$/i.test(account.replace(/-/g, ""))) {
    if (account.includes("usps")) return "usps";
    if (account.includes("ups")) return "ups";
  }
  return null;
}

/** Prefer Shippo's servicelevel_name; when TEST APIs return a generic name, label from the real servicelevel_token. */
export function shippoServiceLabel(name: unknown, token: unknown, fallback?: unknown) {
  const trimmedName = String(name ?? "").trim();
  const trimmedToken = String(token ?? "").trim();
  const trimmedFallback = String(fallback ?? "").trim();
  const generic = !trimmedName || /^(shipping|service|rate)$/i.test(trimmedName);
  if (!generic) return trimmedName;
  if (trimmedToken) {
    const humanized = trimmedToken
      .replace(/^(ups|usps)_/i, "")
      .replace(/_/g, " ")
      .replace(/\s+/g, " ")
      .trim()
      .replace(/\b\w/g, (char) => char.toUpperCase());
    if (humanized) return humanized;
  }
  return trimmedFallback || trimmedName || "Shipping";
}

function shippoServiceFields(item: Record<string, unknown>) {
  const nested = item.servicelevel && typeof item.servicelevel === "object" && !Array.isArray(item.servicelevel)
    ? (item.servicelevel as Record<string, unknown>)
    : null;
  const name = item.servicelevel_name ?? nested?.name ?? item.service_name ?? null;
  const token = item.servicelevel_token ?? nested?.token ?? item.service_token ?? null;
  const fallback = item.service ?? nested?.name ?? null;
  return { name, token: String(token ?? "").trim(), fallback };
}

export function mapShippoRates(payload: unknown, allowedServices: string[] = []): ShippoRate[] {
  const root = payload && typeof payload === "object" ? (payload as { rates?: unknown[] }) : {};
  const rates = Array.isArray(root.rates) ? root.rates : [];
  const allowed = new Set(allowedServices.map((item) => item.toLowerCase()));
  return rates.flatMap((row) => {
    if (!row || typeof row !== "object") return [];
    const item = row as Record<string, unknown>;
    const provider = identifyShippoProvider(item.provider, item.carrier_account);
    if (!provider) return [];
    const fields = shippoServiceFields(item);
    const serviceToken = fields.token;
    const service = shippoServiceLabel(fields.name, serviceToken, fields.fallback);
    if (allowed.size && !allowed.has(service.toLowerCase()) && !allowed.has(serviceToken.toLowerCase())) {
      return [];
    }
    const amount = Number(item.amount);
    if (!Number.isFinite(amount) || amount < 0) return [];
    const daysRaw = item.estimated_days;
    const estimatedDays = typeof daysRaw === "number" && Number.isFinite(daysRaw) ? daysRaw : null;
    return [{
      objectId: String(item.object_id || ""),
      provider,
      service,
      serviceToken,
      amount: Number(amount.toFixed(2)),
      currency: String(item.currency || "USD").toUpperCase(),
      estimatedDays,
      durationTerms: item.duration_terms ? String(item.duration_terms) : null,
      test: item.test === true,
    }];
  });
}

function liveAmountOk(option: { rateMode?: string; amount: number }, quotedShipping?: number | null) {
  if (option.rateMode !== "live_api") return { ok: true as const };
  if (quotedShipping == null || !Number.isFinite(quotedShipping)) {
    // Missing client quote amount is a state/handoff bug — not a disappeared Shippo service.
    return {
      ok: false as const,
      error: "Confirm your shipping rate before paying. Your address and cart were kept.",
      stale: true,
    };
  }
  if (Math.abs(option.amount - quotedShipping) >= 0.015) {
    return { ok: false as const, error: "The live shipping quote changed. Review the new rate before placing the order.", stale: true };
  }
  return { ok: true as const };
}

/** Carrier + service token only — ignores ETA day drift between Shippo refreshes. */
export function liveServiceKeyFromOptionId(id: string) {
  const parts = id.split(":");
  if (parts.length < 3 || parts[1] !== "live") return id;
  return normalizeLiveServiceKey(parts.slice(0, 3).join(":"));
}

/** Collapse ups-ground / ground (and usps-*) so Shippo token drift does not false-expire rates. */
export function normalizeLiveServiceKey(key: string) {
  const parts = key.split(":");
  if (parts.length < 3 || parts[1] !== "live") return key;
  const provider = parts[0];
  let token = parts[2] || "service";
  if (provider === "ups" || provider === "usps") {
    const prefix = `${provider}-`;
    if (token.startsWith(prefix)) token = token.slice(prefix.length);
  }
  return `${provider}:live:${token || "service"}`;
}

export function liveServiceKey(option: {
  provider: string;
  serviceCode?: string;
  serviceToken?: string;
  id?: string;
}) {
  if (option.provider !== "ups" && option.provider !== "usps") {
    return option.id ? liveServiceKeyFromOptionId(option.id) : "";
  }
  const token = serviceSlug(option.serviceToken || option.serviceCode || "");
  return normalizeLiveServiceKey(`${option.provider}:live:${token || "service"}`);
}

function findLiveMatches<T extends {
  id: string;
  provider: string;
  fulfillmentMethod: "delivery" | "local_pickup";
  rateMode?: string;
  amount?: number;
  serviceCode?: string;
  serviceToken?: string;
  etaDays?: number | null;
}>(options: T[], wanted: string, fulfillmentMethod: "delivery" | "local_pickup", quotedShipping?: number | null) {
  const wantedIdentity = liveIdentityFromOptionId(wanted);
  const wantedService = liveServiceKeyFromOptionId(wanted);
  const wantedProvider = wanted.split(":")[0];
  const liveRows = options.filter((row) => (
    row.fulfillmentMethod === fulfillmentMethod
    && row.rateMode === "live_api"
    && (row.provider === "ups" || row.provider === "usps")
  ));
  const byIdentity = liveRows.filter((row) => liveQuoteIdentity(row) === wantedIdentity);
  if (byIdentity.length === 1) return byIdentity;
  if (byIdentity.length > 1) return byIdentity;
  // ETA days often change between Shippo shipments for the same UPS/USPS service.
  const byService = liveRows.filter((row) => liveServiceKey(row) === wantedService);
  if (byService.length) return byService;
  // Last resort: unique same-carrier rate at the customer-quoted price (never substitute another carrier).
  if (
    (wantedProvider === "ups" || wantedProvider === "usps")
    && quotedShipping != null
    && Number.isFinite(quotedShipping)
  ) {
    const priced = liveRows.filter((row) => (
      row.provider === wantedProvider
      && typeof row.amount === "number"
      && Math.abs(row.amount - quotedShipping) < 0.015
    ));
    if (priced.length === 1) return priced;
  }
  return [];
}

export function resolveSelectedShippingOption<T extends {
  id: string;
  provider: string;
  fulfillmentMethod: "delivery" | "local_pickup";
  amount: number;
  rateMode?: string;
  serviceCode?: string;
  serviceToken?: string;
  etaDays?: number | null;
}>(
  options: T[],
  selectedId: string | undefined,
  fulfillmentMethod: "delivery" | "local_pickup",
  quotedShipping?: number | null,
): { option: T } | { error: string; stale?: boolean } {
  const wanted = selectedId || (fulfillmentMethod === "local_pickup" ? "pickup" : "");
  const exact = options.find((row) => row.id === wanted && row.fulfillmentMethod === fulfillmentMethod);
  if (exact) {
    const check = liveAmountOk(exact, quotedShipping);
    if (!check.ok) return { error: check.error, stale: check.stale };
    return { option: exact };
  }
  if (wanted.includes(":live:")) {
    const matches = findLiveMatches(options, wanted, fulfillmentMethod, quotedShipping);
    if (matches.length === 1) {
      const check = liveAmountOk(matches[0], quotedShipping);
      if (!check.ok) return { error: check.error, stale: check.stale };
      return { option: matches[0] };
    }
    if (matches.length === 0) {
      const carrier = wanted.startsWith("ups:") ? "UPS" : wanted.startsWith("usps:") ? "USPS" : "carrier";
      return {
        error: `The ${carrier} rate is no longer available for this address and package. Your cart and address were kept — choose another shipping method.`,
        stale: true,
      };
    }
    // Ambiguous services: prefer the one matching the quoted amount when available.
    if (quotedShipping != null && Number.isFinite(quotedShipping)) {
      const priced = matches.filter((row) => Math.abs(row.amount - quotedShipping) < 0.015);
      if (priced.length === 1) return { option: priced[0] };
    }
    return { error: "The live shipping quote changed. Review the new rate before placing the order.", stale: true };
  }
  return { error: "Choose an available pickup or delivery option." };
}

export function ratesMatchSelection(
  selected: { id?: string; provider?: string; serviceCode?: string; amount?: number; shippoRateId?: string | null },
  fresh: Array<{ id: string; provider: string; serviceCode?: string; amount: number; shippoRateId?: string | null }>,
) {
  return fresh.some((option) => {
    if (selected.shippoRateId && option.shippoRateId && selected.shippoRateId === option.shippoRateId) {
      return Math.abs(option.amount - Number(selected.amount ?? 0)) < 0.015;
    }
    if (option.id === selected.id) return Math.abs(option.amount - Number(selected.amount ?? 0)) < 0.015;
    return option.provider === selected.provider
      && (option.serviceCode || "") === (selected.serviceCode || "")
      && Math.abs(option.amount - Number(selected.amount ?? 0)) < 0.015;
  });
}

export function canPrepareShippoLabel(input: { isTest: boolean; postagePurchasesEnabled: boolean }) {
  return input.isTest && !input.postagePurchasesEnabled;
}

export function serviceSlug(service: string) {
  return service.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "service";
}

export function liveOptionId(
  provider: "ups" | "usps",
  service: string,
  extras?: { token?: string | null; days?: number | null },
) {
  const identity = serviceSlug(extras?.token || service);
  const days = extras?.days != null && Number.isFinite(extras.days) ? `${Math.trunc(extras.days)}d` : "x";
  return `${provider}:live:${identity}:${days}`;
}

export function liveIdentityFromOptionId(id: string) {
  const parts = id.split(":");
  if (parts.length < 4 || parts[1] !== "live") return id;
  return parts.slice(0, 4).join(":");
}

export function liveQuoteIdentity(option: {
  provider: string;
  serviceCode?: string;
  serviceToken?: string;
  etaDays?: number | null;
}) {
  if (option.provider !== "ups" && option.provider !== "usps") return "";
  return liveOptionId(option.provider, option.serviceToken || option.serviceCode || "", { days: option.etaDays });
}

export function assignUniqueLiveOptionIds<T extends { id: string; shippoRateId?: string | null }>(options: T[]): T[] {
  const used = new Set<string>();
  return options.map((option) => {
    let id = option.id;
    if (used.has(id)) {
      const extra = serviceSlug(option.shippoRateId || "") || `dup${used.size}`;
      id = `${id}:${extra}`;
    }
    used.add(id);
    return { ...option, id };
  });
}

type Address = {
  name?: string;
  address_line_1?: string;
  address_line_2?: string;
  city?: string;
  state?: string;
  postal_code?: string;
  country?: string;
  phone?: string;
};

function shippoAddress(address: Address) {
  return {
    name: address.name || "Ivoire Shop",
    street1: address.address_line_1 || "",
    street2: address.address_line_2 || "",
    city: address.city || "",
    state: address.state || "",
    zip: address.postal_code || "",
    country: (address.country || "US").slice(0, 2).toUpperCase() === "US" || (address.country || "").toUpperCase() === "USA" ? "US" : (address.country || "US").slice(0, 2).toUpperCase(),
    phone: address.phone || "",
  };
}

async function shippoRequest(path: string, init?: RequestInit) {
  const creds = shippoCredentials();
  if (!creds.configured) return { ok: false as const, status: 0, body: null as unknown };
  const response = await fetch(`https://api.goshippo.com${path}`, {
    ...init,
    headers: {
      Authorization: `ShippoToken ${creds.token}`,
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });
  const body = await response.json().catch(() => null);
  return { ok: response.ok, status: response.status, body };
}

type ShippoAccountsSnapshot = {
  ok: boolean;
  ups: number;
  usps: number;
  accountIds: string[];
  carriers: Array<{ id: string; carrier: string; provider: "ups" | "usps"; test: boolean }>;
};

let shippoAccountsCache: { at: number; value: ShippoAccountsSnapshot } | null = null;
const SHIPPO_ACCOUNTS_TTL_MS = 5 * 60_000;

export async function listShippoCarrierAccounts(options?: { force?: boolean }) {
  if (!options?.force && shippoAccountsCache && Date.now() - shippoAccountsCache.at < SHIPPO_ACCOUNTS_TTL_MS) {
    return shippoAccountsCache.value;
  }
  const accounts: Array<{ object_id?: string; carrier?: string; active?: boolean; test?: boolean; provider: "ups" | "usps" }> = [];
  let url: string | null = "/carrier_accounts/?results=100";
  let pages = 0;
  let ok = true;
  while (url && pages < 5) {
    pages += 1;
    const result = await shippoRequest(url);
    if (!result.ok) {
      ok = false;
      break;
    }
    const body = result.body && typeof result.body === "object"
      ? (result.body as { results?: Array<{ object_id?: string; carrier?: string; active?: boolean; test?: boolean }>; next?: string | null })
      : {};
    for (const row of body.results ?? []) {
      if (row.active === false) continue;
      const provider = identifyShippoProvider(row.carrier);
      if (!provider) continue;
      accounts.push({ ...row, provider });
    }
    const next = body.next ? String(body.next) : "";
    url = next
      ? (next.startsWith("http") ? next.replace("https://api.goshippo.com", "") : next)
      : null;
  }
  const value: ShippoAccountsSnapshot = {
    ok,
    ups: accounts.filter((row) => row.provider === "ups").length,
    usps: accounts.filter((row) => row.provider === "usps").length,
    accountIds: accounts.map((row) => String(row.object_id || "")).filter(Boolean),
    carriers: accounts.map((row) => ({
      id: String(row.object_id || ""),
      carrier: String(row.carrier || ""),
      provider: row.provider,
      test: row.test === true,
    })),
  };
  if (ok) shippoAccountsCache = { at: Date.now(), value };
  return value;
}

function shippoErrorText(body: unknown, status: number) {
  if (!body || typeof body !== "object") return status ? `HTTP ${status}` : "";
  const row = body as { detail?: unknown; message?: unknown; messages?: Array<{ text?: string; code?: string; source?: string }> };
  const parts = [
    row.detail != null ? String(row.detail) : "",
    row.message != null ? String(row.message) : "",
    ...(Array.isArray(row.messages) ? row.messages.map((item) => `${item.source || ""} ${item.code || ""} ${item.text || ""}`.trim()) : []),
  ].filter(Boolean);
  return parts.join(" · ") || (status ? `HTTP ${status}` : "");
}

export function isShippoRateLimitStatus(status: number, text = "") {
  return status === 429 || /too many requests|10429|rate.?limit/i.test(text);
}

export async function quoteShippoShipment(input: {
  origin: Address;
  destination: Address;
  parcel: { weightLb: number; lengthIn: number; widthIn: number; heightIn: number };
  allowedServices?: string[];
  carrierAccountIds?: string[];
}) {
  const creds = shippoCredentials();
  if (!creds.configured) return { ok: false as const, error: "Shippo is not configured.", rates: [] as ShippoRate[] };
  const payload: Record<string, unknown> = {
    address_from: shippoAddress(input.origin),
    address_to: shippoAddress(input.destination),
    parcels: [{
      length: String(input.parcel.lengthIn),
      width: String(input.parcel.widthIn),
      height: String(input.parcel.heightIn),
      distance_unit: "in",
      weight: String(input.parcel.weightLb),
      mass_unit: "lb",
    }],
    async: false,
  };
  if (input.carrierAccountIds?.length) payload.carrier_accounts = input.carrierAccountIds;
  const result = await shippoRequest("/shipments/", { method: "POST", body: JSON.stringify(payload) });
  const messagesRaw = result.body && typeof result.body === "object"
    ? (result.body as { messages?: Array<{ source?: string; code?: string; text?: string }> }).messages
    : null;
  const carrierMessages = Array.isArray(messagesRaw)
    ? messagesRaw
      .filter((row) => row && (row.source === "UPS" || row.source === "USPS"))
      .map((row) => `${row.source}${row.code ? ` ${row.code}` : ""}: ${String(row.text || "").trim()}`.trim())
      .filter((text) => text.length > 4)
    : [];
  if (!result.ok) {
    const errorText = shippoErrorText(result.body, result.status);
    const rateLimited = isShippoRateLimitStatus(result.status, `${errorText} ${carrierMessages.join(" ")}`);
    // Never log tokens or full addresses — status + sanitized codes only.
    console.info("[shippo]", {
      operation: "shipments",
      ok: false,
      status: result.status,
      rateLimited,
      message: rateLimited ? "rate_limited" : "request_failed",
    });
    return {
      ok: false as const,
      error: rateLimited
        ? "Shippo rate limit (10429/429). Retry shortly — no substitute rate was invented."
        : "Shippo could not return rates.",
      rates: [] as ShippoRate[],
      carrierMessages: rateLimited
        ? [...carrierMessages, "UPS 10429: Too Many Requests", "USPS 10429: Too Many Requests"]
        : carrierMessages,
      rateLimited,
      status: result.status,
    };
  }
  return {
    ok: true as const,
    shipmentId: result.body && typeof result.body === "object" ? String((result.body as { object_id?: string }).object_id || "") : "",
    rates: mapShippoRates(result.body, input.allowedServices),
    test: creds.isTest,
    carrierMessages,
    rateLimited: carrierMessages.some((text) => isShippoRateLimitStatus(0, text)),
    status: result.status,
  };
}

export async function createShippoTestTransaction(rateObjectId: string, postagePurchasesEnabled = false) {
  const creds = shippoCredentials();
  if (!canPrepareShippoLabel({ isTest: creds.isTest, postagePurchasesEnabled })) {
    return { ok: false as const, error: "Live postage purchasing is disabled." };
  }
  if (!rateObjectId) return { ok: false as const, error: "A Shippo rate is required." };
  const result = await shippoRequest("/transactions/", {
    method: "POST",
    body: JSON.stringify({ rate: rateObjectId, label_file_type: "PDF", async: false }),
  });
  if (!result.ok || !result.body || typeof result.body !== "object") {
    return { ok: false as const, error: "The test label could not be prepared." };
  }
  const row = result.body as { tracking_number?: string; label_url?: string; object_id?: string; status?: string };
  return {
    ok: true as const,
    trackingNumber: row.tracking_number || null,
    labelUrl: row.label_url || null,
    transactionId: row.object_id || null,
    status: row.status || null,
  };
}
