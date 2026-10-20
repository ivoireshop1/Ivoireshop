import { readFile } from "node:fs/promises";
import { resolve, sep } from "node:path";
import { CANONICAL_PRODUCTION_ORIGIN, resolvePublicSiteUrl } from "@/src/lib/site";
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

export function publicImageOrigins(env: NodeJS.ProcessEnv = process.env) {
  const origins: string[] = [];
  const push = (value: string) => {
    const origin = value.trim().replace(/\/$/, "");
    if (!origin || origins.includes(origin)) return;
    origins.push(origin);
  };

  // Production serverless functions must not self-fetch VERCEL_URL first.
  // Unique deployment hosts are often protected; catalog images already load on Steel.
  if (env.VERCEL_ENV === "production") push(CANONICAL_PRODUCTION_ORIGIN);

  const vercelHost = (env.VERCEL_URL || env.VERCEL_PROJECT_PRODUCTION_URL || "")
    .replace(/^https?:\/\//, "")
    .replace(/\/$/, "");
  if (env.VERCEL && vercelHost) push(`https://${vercelHost}`);

  const site = resolvePublicSiteUrl(env).replace(/\/$/, "");
  if (site) push(site);
  return origins;
}

export function publicImageOrigin(env: NodeJS.ProcessEnv = process.env) {
  return publicImageOrigins(env)[0] ?? "";
}

export function publicImageHttpUrls(imageUrl: string, env: NodeJS.ProcessEnv = process.env) {
  const encodedPath = encodePublicImagePath(imageUrl);
  if (!encodedPath) return [];
  return publicImageOrigins(env).map((origin) => `${origin}${encodedPath}`);
}

export function publicImageHttpUrl(imageUrl: string, env: NodeJS.ProcessEnv = process.env) {
  return publicImageHttpUrls(imageUrl, env)[0] ?? null;
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
  if (!isTrustedProductImageUrl(imageUrl)) {
    return { ok: false as const, status: 0, contentType: null, bytes: 0, source: "rejected" as const };
  }
  const mediaType = mediaTypeFromImageUrl(imageUrl);
  if (imageUrl.startsWith("/images/")) {
    const diskPath = publicImageDiskPath(imageUrl);
    if (diskPath) {
      try {
        const bytes = await readFile(diskPath);
        if (bytes.length && bytes.byteLength <= MAX_IMAGE_BYTES) {
          return {
            ok: true as const,
            bytes,
            mediaType,
            status: 200,
            contentType: mediaType,
            source: "disk" as const,
          };
        }
      } catch {
        // Serverless runtimes serve /images from the CDN, not the function disk.
      }
    }
    const httpUrls = publicImageHttpUrls(imageUrl);
    if (!httpUrls.length) {
      return { ok: false as const, status: 0, contentType: null, bytes: 0, source: "http" as const };
    }
    let lastStatus = 0;
    let lastType: string | null = null;
    for (const httpUrl of httpUrls) {
      if (!isTrustedProductImageUrl(new URL(httpUrl).pathname)) continue;
      try {
        const response = await fetch(httpUrl, { redirect: "error" });
        const parsed = await bytesFromResponse(response, mediaType);
        if (parsed) {
          return {
            ok: true as const,
            bytes: parsed.bytes,
            mediaType: parsed.mediaType,
            status: response.status,
            contentType: parsed.mediaType,
            source: "http" as const,
          };
        }
        lastStatus = response.status;
        lastType = response.headers.get("content-type");
      } catch {
        lastStatus = 0;
        lastType = null;
      }
    }
    return { ok: false as const, status: lastStatus, contentType: lastType, bytes: 0, source: "http" as const };
  }
  try {
    const response = await fetch(imageUrl, { redirect: "error" });
    const parsed = await bytesFromResponse(response, mediaType);
    if (!parsed) {
      return {
        ok: false as const,
        status: response.status,
        contentType: response.headers.get("content-type"),
        bytes: 0,
        source: "supabase" as const,
      };
    }
    return {
      ok: true as const,
      bytes: parsed.bytes,
      mediaType: parsed.mediaType,
      status: response.status,
      contentType: parsed.mediaType,
      source: "supabase" as const,
    };
  } catch {
    return { ok: false as const, status: 0, contentType: null, bytes: 0, source: "supabase" as const };
  }
}
