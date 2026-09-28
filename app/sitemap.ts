import type { MetadataRoute } from "next";
import { getProducts } from "@/src/lib/catalog/catalog";
import { siteConfig } from "@/src/lib/site";

export const dynamic = "force-dynamic";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const products = await getProducts();
  return ["/", "/shop", "/categories", "/about", "/contact", ...products.map((product) => `/product/${encodeURIComponent(product.slug)}`)]
    .map((path) => ({ url: new URL(path, siteConfig.url).href }));
}
