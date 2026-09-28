export function isNextImageSrc(src: string) {
  if (src.startsWith("/") && !src.startsWith("//") && !src.includes("\\")) return true;
  try {
    const host = new URL(src).hostname;
    return host.endsWith(".supabase.co") || host === "images.unsplash.com";
  } catch {
    return false;
  }
}

export function isPersistentImageUrl(value: string): boolean {
  if (value.startsWith("/") && !value.startsWith("//") && !value.includes("\\")) return true;
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:";
  } catch {
    return false;
  }
}

export function productImagesObjectPath(value: string) {
  const marker = "/storage/v1/object/public/product-images/";
  const index = value.indexOf(marker);
  if (index === -1) return null;
  return decodeURIComponent(value.slice(index + marker.length).split("?")[0]);
}
