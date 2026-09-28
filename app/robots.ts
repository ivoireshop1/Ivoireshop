import type { MetadataRoute } from "next";
import { siteConfig } from "@/src/lib/site";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: "*", allow: "/", disallow: ["/admin", "/api", "/account", "/auth", "/cart", "/checkout", "/wishlist", "/login", "/signup", "/reset-password", "/update-password"] },
    sitemap: new URL("/sitemap.xml", siteConfig.url).href,
  };
}
