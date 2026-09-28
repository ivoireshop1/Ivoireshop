export function isTrustedProductImageUrl(value: string) {
  const source = String(value ?? "").trim();
  if (!source || source.includes("\\") || source.includes("..")) return false;
  if (source.startsWith("/images/") && !source.startsWith("//")) {
    try {
      const decoded = decodeURIComponent(source);
      if (decoded.includes("..") || decoded.includes("\\")) return false;
    } catch {
      return false;
    }
    return true;
  }
  try {
    const url = new URL(source);
    if (url.protocol !== "https:") return false;
    return (
      url.hostname.endsWith(".supabase.co") &&
      url.pathname.includes("/storage/v1/object/public/product-images/")
    );
  } catch {
    return false;
  }
}
