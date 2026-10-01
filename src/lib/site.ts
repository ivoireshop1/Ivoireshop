function isLocalHost(value: string) {
  return /localhost|127\.0\.0\.1/i.test(value);
}

/** Public customer storefront. Never a Vercel deployment or team alias hostname. */
export const CANONICAL_PRODUCTION_ORIGIN = "https://ivoire-shop-five.vercel.app";

const TRUSTED_PRODUCTION_HOSTS = new Set(["ivoire-shop-five.vercel.app"]);

function parseHttpUrl(value: string) {
  try {
    const url = new URL(value.includes("://") ? value : `https://${value}`);
    if (url.protocol !== "http:" && url.protocol !== "https:") return null;
    return url;
  } catch {
    return null;
  }
}

export function isTrustedPublicSiteOrigin(value: string) {
  const url = parseHttpUrl(value);
  return Boolean(url && TRUSTED_PRODUCTION_HOSTS.has(url.host));
}

export function isProtectedInfrastructureOrigin(value: string) {
  const url = parseHttpUrl(value);
  if (!url) return false;
  if (TRUSTED_PRODUCTION_HOSTS.has(url.host)) return false;
  return (
    url.host === "vercel.com" ||
    url.host === "vercel.app" ||
    url.host.endsWith(".vercel.app")
  );
}

function normalizeOrigin(value: string) {
  return value.trim().replace(/\/$/, "");
}

function trustedOrigin(value: string | undefined) {
  const trimmed = normalizeOrigin(value ?? "");
  if (!trimmed || isProtectedInfrastructureOrigin(trimmed)) return "";
  if (isTrustedPublicSiteOrigin(trimmed)) {
    const url = parseHttpUrl(trimmed);
    return url ? `${url.protocol}//${url.host}` : CANONICAL_PRODUCTION_ORIGIN;
  }
  return "";
}

export function resolvePublicSiteUrl(
  env: NodeJS.ProcessEnv,
  browserOrigin?: string,
) {
  const envUrl = normalizeOrigin(env.NEXT_PUBLIC_SITE_URL ?? "");
  const origin = normalizeOrigin(browserOrigin ?? "");
  const vercelEnv = env.VERCEL_ENV ?? "";
  const onVercel = vercelEnv === "production" || vercelEnv === "preview";

  const trusted = trustedOrigin(origin) || trustedOrigin(envUrl);
  if (trusted) return trusted;

  if (onVercel) {
    return CANONICAL_PRODUCTION_ORIGIN;
  }

  if (origin && isLocalHost(origin)) return origin;
  if (envUrl && isLocalHost(envUrl)) return envUrl;
  return "http://localhost:3000";
}

export function getPublicSiteUrl() {
  const browserOrigin = typeof window !== "undefined" ? window.location.origin : undefined;
  return resolvePublicSiteUrl(process.env as NodeJS.ProcessEnv, browserOrigin);
}

export function getAuthCallbackUrl(nextPath: string) {
  const next = nextPath.startsWith("/") && !nextPath.startsWith("//") ? nextPath : "/account";
  return `${getPublicSiteUrl()}/auth/callback?next=${encodeURIComponent(next)}`;
}

export const siteConfig = {
  name: "Ivoire Shop",
  description:
    "Shop African and international food products, pantry staples, and groceries at Ivoire Shop.",
  get url() {
    return getPublicSiteUrl();
  },
};
