function isLocalHost(value: string) {
  return /localhost|127\.0\.0\.1/i.test(value);
}

/**
 * Customer storefront. The Steel alias stays trusted so a session started there
 * can finish there. Never Ibrahim's ivoire-shop-five.
 */
export const CANONICAL_PRODUCTION_ORIGIN = "https://ivoireshop.business";

const TRUSTED_PRODUCTION_HOSTS = new Set([
  "ivoireshop.business",
  "www.ivoireshop.business",
  "ivoireshop-steel.vercel.app",
]);

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

function vercelPreviewOrigin(env: NodeJS.ProcessEnv, browserOrigin?: string) {
  const origin = normalizeOrigin(browserOrigin ?? "");
  if (origin && parseHttpUrl(origin)?.host.endsWith(".vercel.app")) return origin;
  const vercelUrl = normalizeOrigin(env.VERCEL_URL ?? "");
  if (!vercelUrl) return "";
  const host = vercelUrl.replace(/^https?:\/\//i, "");
  return host ? `https://${host}` : "";
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

  if (vercelEnv === "production") {
    // Keep the host that started signup or password reset. The PKCE verifier
    // cookie is host-only, so a later hop to a different domain cannot redeem it.
    return trustedOrigin(origin) || CANONICAL_PRODUCTION_ORIGIN;
  }

  // Preview + staging Supabase must keep their own deployment origin. Sending
  // customers to Production would exchange auth codes against the wrong project.
  // Client bundles often lack VERCEL_ENV, so also accept a *.vercel.app browser origin
  // when we are not in the production environment.
  if (
    vercelEnv === "preview" ||
    (vercelEnv !== "production" &&
      origin &&
      parseHttpUrl(origin)?.host.endsWith(".vercel.app") &&
      !isTrustedPublicSiteOrigin(origin))
  ) {
    const preview = vercelPreviewOrigin(env, browserOrigin);
    if (preview) return preview;
  }

  const trusted = trustedOrigin(origin) || trustedOrigin(envUrl);
  if (trusted) return trusted;

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
  // Use the trusted origin that started the flow. Forcing one production host
  // emails a code the other host cannot redeem.
  return `${getPublicSiteUrl()}/auth/callback?next=${encodeURIComponent(next)}`;
}

/** Password-reset emails must land on the recovery callback, never a generic post-login path. */
export function getPasswordRecoveryCallbackUrl() {
  return `${getPublicSiteUrl().replace(/\/$/, "")}/auth/callback/recovery`;
}

export const siteConfig = {
  name: "Ivoire Shop",
  description:
    "Shop African and international food products, pantry staples, and groceries at Ivoire Shop.",
  get url() {
    return getPublicSiteUrl();
  },
};
