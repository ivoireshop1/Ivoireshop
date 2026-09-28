function isLocalHost(value: string) {
  return /localhost|127\.0\.0\.1/i.test(value);
}

export function resolvePublicSiteUrl(
  env: NodeJS.ProcessEnv,
  browserOrigin?: string,
) {
  const envUrl = (env.NEXT_PUBLIC_SITE_URL ?? "").trim().replace(/\/$/, "");
  const origin = (browserOrigin ?? "").replace(/\/$/, "");

  if (origin && !isLocalHost(origin)) {
    return origin;
  }
  if (envUrl && !isLocalHost(envUrl)) {
    return envUrl;
  }
  if (env.VERCEL_ENV === "production") {
    const vercelProd = (env.VERCEL_PROJECT_PRODUCTION_URL ?? "").replace(/^https?:\/\//, "").replace(/\/$/, "");
    if (vercelProd) {
      return `https://${vercelProd}`;
    }
  }
  if (origin) return origin;
  if (envUrl) return envUrl;
  return "http://localhost:3000";
}

export function getPublicSiteUrl() {
  const browserOrigin = typeof window !== "undefined" ? window.location.origin : undefined;
  return resolvePublicSiteUrl(process.env as NodeJS.ProcessEnv, browserOrigin);
}

export const siteConfig = {
  name: "Ivoire Shop",
  description:
    "Shop African and international food products, pantry staples, and groceries at Ivoire Shop.",
  get url() {
    return getPublicSiteUrl();
  },
};
