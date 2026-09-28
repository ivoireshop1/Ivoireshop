import type { Metadata } from "next";
import { siteConfig } from "./site";

export function pageMetadata(title: string, description: string, path: string, index = true): Metadata {
  return {
    title, description,
    alternates: { canonical: path },
    robots: index ? undefined : { index: false, follow: false },
    openGraph: { title, description, url: path, siteName: siteConfig.name, type: "website" },
    twitter: { card: "summary", title, description },
  };
}
