import { readFile } from "node:fs/promises";
import { resolve, sep } from "node:path";
import { resolvePublicSiteUrl } from "@/src/lib/site";
import { isTrustedProductImageUrl } from "@/src/lib/catalog/trusted-product-image";

const MEDIA_TYPES: Record<string, string> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  gif: "image/gif",
  avif: "image/avif",
};

const MAX_IMAGE_BYTES = 8 * 1024 * 1024;

export function mediaTypeFromImageUrl(imageUrl: string) {
  const clean = imageUrl.split("?")[0] ?? "";
  const extension = clean.split(".").pop()?.toLowerCase() ?? "";
  return MEDIA_TYPES[extension] ?? "image/jpeg";
}

export function encodePublicImagePath(imageUrl: string) {
  const pathOnly = String(imageUrl ?? "").split("?")[0] ?? "";
  if (!pathOnly.startsWith("/images/") || pathOnly.startsWith("//")) return null;
  try {
    return pathOnly
      .split("/")
      .map((segment) => {
        if (!segment) return "";
        return encodeURIComponent(decodeURIComponent(segment));
      })
      .join("/");
  } catch {
    return null;
  }
}

export function publicImageOrigin() {
  const site = resolvePublicSiteUrl(process.env).replace(/\/$/, "");
  if (site && !/localhost|127\.0\.0\.1/i.test(site)) return site;
  const vercelHost = (process.env.VERCEL_PROJECT_PRODUCTION_URL || process.env.VERCEL_URL || "")
    .replace(/^https?:\/\//, "")
    .replace(/\/$/, "");
  if (vercelHost) return `https://${vercelHost}`;
  return site;
}

export function publicImageHttpUrl(imageUrl: string) {
  const encodedPath = encodePublicImagePath(imageUrl);
  const origin = publicImageOrigin();
  if (!encodedPath || !origin) return null;
  return `${origin}${encodedPath}`;
}

export function publicImageDiskPath(imageUrl: string) {
  if (!imageUrl.startsWith("/images/")) return null;
  try {
    const relative = decodeURIComponent(imageUrl.replace(/^\/+/, "").split("?")[0] ?? "");
    const resolved = resolve(process.cwd(), "public", relative);
    const root = resolve(process.cwd(), "public", "images");
    if (!resolved.startsWith(root + sep) && resolved !== root) return null;
    return resolved;
  } catch {
    return null;
  }
}

async function bytesFromResponse(response: Response, fallbackType: string) {
  if (!response.ok) return null;
  const contentType = response.headers.get("content-type") ?? fallbackType;
  if (!contentType.startsWith("image/")) return null;
  const length = Number(response.headers.get("content-length") ?? "0");
  if (Number.isFinite(length) && length > MAX_IMAGE_BYTES) return null;
  const bytes = new Uint8Array(await response.arrayBuffer());
  if (!bytes.length || bytes.byteLength > MAX_IMAGE_BYTES) return null;
  return { bytes, mediaType: contentType.split(";")[0] ?? fallbackType };
}

export async function readTrustedProductImage(imageUrl: string) {
  if (!isTrustedProductImageUrl(imageUrl)) return null;
  const mediaType = mediaTypeFromImageUrl(imageUrl);
  if (imageUrl.startsWith("/images/")) {
    const diskPath = publicImageDiskPath(imageUrl);
    if (diskPath) {
      try {
        const bytes = await readFile(diskPath);
        if (bytes.length && bytes.byteLength <= MAX_IMAGE_BYTES) {
          return { bytes, mediaType };
        }
      } catch {
        // Serverless runtimes serve /images from the CDN, not the function disk.
      }
    }
    const httpUrl = publicImageHttpUrl(imageUrl);
    if (!httpUrl || !isTrustedProductImageUrl(new URL(httpUrl).pathname)) return null;
    try {
      const response = await fetch(httpUrl, { redirect: "error" });
      return await bytesFromResponse(response, mediaType);
    } catch {
      return null;
    }
  }
  try {
    const response = await fetch(imageUrl, { redirect: "error" });
    return await bytesFromResponse(response, mediaType);
  } catch {
    return null;
  }
}
