import type { CanonicalCategoryName } from "@/src/lib/catalog/category-review";

export type SourceFolderCategory = CanonicalCategoryName;

function normalizeFolder(value: string) {
  return value.toLowerCase().replace(/[%20_+]+/g, " ").replace(/[^a-z0-9]+/g, " ").trim();
}

export function canonicalCategoryFromSourceFolder(folderOrPath: string): SourceFolderCategory | null {
  const source = String(folderOrPath ?? "").trim();
  if (!source) return null;
  const firstSegment = source.replace(/\\/g, "/").split("/").find((part) => part.trim()) ?? source;
  const key = normalizeFolder(decodeURIComponentSafe(firstSegment));
  if (/\bcomestic|\bcosmetic/.test(key)) return "Cosmetics";
  if (/\bivoire market\b/.test(key)) return "Ivoire Market";
  if (/\bfoods?\b/.test(key)) return "Foods";
  return null;
}

function decodeURIComponentSafe(value: string) {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

export function publicImageUrlFromSourcePath(relativePath: string) {
  const encoded = relativePath
    .replace(/\\/g, "/")
    .split("/")
    .filter(Boolean)
    .map((part) => encodeURIComponent(part))
    .join("/");
  return `/images/Foods%2012-22-25/${encoded}`;
}

export function draftSlugFromSource(filename: string, sha256: string) {
  const digest = String(sha256 || "").replace(/[^a-f0-9]/gi, "").slice(0, 12).toLowerCase();
  const fromName = String(filename || "")
    .toLowerCase()
    .replace(/\.[a-z0-9]+$/i, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
  return `src-${digest || "image"}${fromName ? `-${fromName}` : ""}`;
}

export function draftNameFromSource(filename: string) {
  const base = String(filename || "")
    .replace(/\.[a-z0-9]+$/i, "")
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return base || "Untitled product";
}

export function shouldCreateImportedDraft(input: {
  imageUrl: string;
  slug: string;
  existingImageUrls: Iterable<string>;
  existingSlugs: Iterable<string>;
}) {
  const images = new Set(input.existingImageUrls);
  const slugs = new Set(input.existingSlugs);
  if (images.has(input.imageUrl)) return false;
  if (slugs.has(input.slug)) return false;
  return true;
}

export const SOURCE_FOLDER_CATEGORY_SLUG: Record<SourceFolderCategory, string> = {
  Cosmetics: "cosmetics",
  Foods: "foods",
  "Ivoire Market": "ivoire-market",
};
