/** Keep in sync with CANONICAL_PRODUCTION_ORIGIN in src/lib/site.ts */
const FALLBACK_STOREFRONT_URL = "https://ivoireshop-steel.vercel.app";

/** Checkout and Stripe/PayPal paths are USD-only today. */
export const SUPPORTED_STORE_CURRENCIES = ["USD"] as const;
export type SupportedStoreCurrency = (typeof SUPPORTED_STORE_CURRENCIES)[number];

export type StoreProfile = {
  storeName: string;
  storefrontUrl: string;
  defaultCurrency: string;
  supportEmail: string;
  warehousePhone: string;
};

export type StoreEmailBrand = {
  storeName: string;
  supportEmail: string;
  warehousePhone: string;
  storefrontUrl: string;
};

const DEFAULT_STORE_NAME = "Ivoire Shop";

export function isSupportedStoreCurrency(value: string): value is SupportedStoreCurrency {
  return (SUPPORTED_STORE_CURRENCIES as readonly string[]).includes(value);
}

export function normalizeStoreEmail(value: string) {
  return value.trim().toLowerCase();
}

export function isValidSupportEmail(value: string) {
  if (!value) return true;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value) && value.length <= 254;
}

export function isValidWarehousePhone(value: string) {
  if (!value) return true;
  const digits = value.replace(/\D/g, "");
  return digits.length >= 7 && digits.length <= 15 && value.length <= 40;
}

export function parseStorefrontUrl(value: string): { ok: true; url: string } | { ok: false; error: string } {
  const trimmed = value.trim().replace(/\/$/, "");
  if (!trimmed) {
    return { ok: false, error: "Enter a storefront URL (https://…)." };
  }
  let parsed: URL;
  try {
    parsed = new URL(trimmed.includes("://") ? trimmed : `https://${trimmed}`);
  } catch {
    return { ok: false, error: "Enter a valid storefront URL." };
  }
  if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
    return { ok: false, error: "Storefront URL must start with https:// or http://." };
  }
  if (!parsed.hostname) {
    return { ok: false, error: "Enter a valid storefront URL." };
  }
  return {
    ok: true,
    url: `${parsed.protocol}//${parsed.host}${parsed.pathname === "/" ? "" : parsed.pathname}`.replace(/\/$/, ""),
  };
}

export function storefrontUrlConfigSteps(url: string) {
  return [
    `Saving this URL updates store copy only. It does not change Vercel domains.`,
    `If customers use a custom domain, add it in Vercel → Project → Settings → Domains.`,
    `Add the same origin to Supabase Auth → URL Configuration (Site URL and Redirect URLs), including /auth/callback and /auth/callback/recovery.`,
    `Current saved storefront URL: ${url}`,
  ];
}

export function profileFromSettingsRow(row: Record<string, unknown> | null | undefined): StoreProfile {
  const storeName = String(row?.origin_name ?? "").trim() || DEFAULT_STORE_NAME;
  const storefrontUrl = String(row?.storefront_url ?? "").trim() || FALLBACK_STOREFRONT_URL;
  const defaultCurrency = String(row?.default_currency ?? "USD").trim().toUpperCase() || "USD";
  const supportEmail = String(row?.support_email ?? "").trim();
  const warehousePhone = String(row?.origin_phone ?? "").trim();
  return { storeName, storefrontUrl, defaultCurrency, supportEmail, warehousePhone };
}

export function emailBrandFromProfile(profile: StoreProfile): StoreEmailBrand {
  return {
    storeName: profile.storeName,
    supportEmail: profile.supportEmail,
    warehousePhone: profile.warehousePhone,
    storefrontUrl: profile.storefrontUrl,
  };
}
