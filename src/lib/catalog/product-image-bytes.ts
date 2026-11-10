import sharp from "sharp";

export const PRODUCT_IMAGE_MAX_EDGE = 1600;
export const PRODUCT_IMAGE_WEBP_QUALITY = 80;

const COMPRESSIBLE = new Set(["image/jpeg", "image/jpg", "image/png", "image/webp"]);

export type PreparedProductImage = {
  bytes: Buffer;
  contentType: string;
  extension: string;
  compressed: boolean;
  originalBytes: number;
};

function extensionFor(contentType: string, fallback: string) {
  if (contentType === "image/webp") return ".webp";
  if (contentType === "image/png") return ".png";
  if (contentType === "image/jpeg" || contentType === "image/jpg") return ".jpg";
  return fallback.startsWith(".") ? fallback : `.${fallback || "img"}`;
}

/** Resize and encode a product photo. Original bytes are kept when compression does not help. */
export async function compressProductImage(input: {
  bytes: Buffer;
  contentType: string;
  fallbackExtension?: string;
}): Promise<PreparedProductImage> {
  const contentType = input.contentType.toLowerCase();
  const original = {
    bytes: input.bytes,
    contentType,
    extension: extensionFor(contentType, input.fallbackExtension || "img"),
    compressed: false,
    originalBytes: input.bytes.length,
  };
  if (!COMPRESSIBLE.has(contentType)) return original;
  try {
    const encoded = await sharp(input.bytes, { failOn: "none" })
      .rotate()
      .resize({
        width: PRODUCT_IMAGE_MAX_EDGE,
        height: PRODUCT_IMAGE_MAX_EDGE,
        fit: "inside",
        withoutEnlargement: true,
      })
      .webp({ quality: PRODUCT_IMAGE_WEBP_QUALITY })
      .toBuffer();
    if (encoded.length >= input.bytes.length) return original;
    return {
      bytes: encoded,
      contentType: "image/webp",
      extension: ".webp",
      compressed: true,
      originalBytes: input.bytes.length,
    };
  } catch {
    return original;
  }
}

/** Local estimate of the bytes Next's optimizer serves. Does not upload or replace storage objects. */
export async function estimateOptimizedWebp(input: { bytes: Buffer; width: number; quality?: number }) {
  return sharp(input.bytes, { failOn: "none" })
    .rotate()
    .resize({ width: input.width, withoutEnlargement: true })
    .webp({ quality: input.quality ?? 75 })
    .toBuffer();
}
