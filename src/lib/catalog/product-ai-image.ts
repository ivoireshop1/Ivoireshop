import { readFile } from "node:fs/promises";
import { resolve, sep } from "node:path";
import { isTrustedProductImageUrl } from "@/src/lib/catalog/trusted-product-image";

const MEDIA_TYPES: Record<string, string> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  gif: "image/gif",
  avif: "image/avif",
};

export function mediaTypeFromImageUrl(imageUrl: string) {
  const clean = imageUrl.split("?")[0] ?? "";
  const extension = clean.split(".").pop()?.toLowerCase() ?? "";
  return MEDIA_TYPES[extension] ?? "image/jpeg";
}

export function publicImageDiskPath(imageUrl: string) {
  if (!imageUrl.startsWith("/images/")) return null;
  const relative = decodeURIComponent(imageUrl.replace(/^\/+/, ""));
  const resolved = resolve(process.cwd(), "public", relative);
  const root = resolve(process.cwd(), "public", "images");
  if (!resolved.startsWith(root + sep) && resolved !== root) return null;
  return resolved;
}

export async function readTrustedProductImage(imageUrl: string) {
  if (!isTrustedProductImageUrl(imageUrl)) return null;
  const mediaType = mediaTypeFromImageUrl(imageUrl);
  if (imageUrl.startsWith("/images/")) {
    const diskPath = publicImageDiskPath(imageUrl);
    if (!diskPath) return null;
    try {
      const bytes = await readFile(diskPath);
      if (!bytes.length) return null;
      return { bytes, mediaType };
    } catch {
      return null;
    }
  }
  const response = await fetch(imageUrl, { redirect: "error" });
  if (!response.ok) return null;
  const contentType = response.headers.get("content-type") ?? mediaType;
  if (!contentType.startsWith("image/")) return null;
  const bytes = new Uint8Array(await response.arrayBuffer());
  if (!bytes.length) return null;
  return { bytes, mediaType: contentType.split(";")[0] ?? mediaType };
}
