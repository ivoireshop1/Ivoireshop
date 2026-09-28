import type { CanonicalCategoryName } from "@/src/lib/catalog/category-review";

export type SourceFolderCategory = CanonicalCategoryName;

type SourceFolderRule = {
  folder: string;
  category: SourceFolderCategory;
};

// Exact child folders. "Foods 12-22-25" is also the shared parent of the other
// two, so a path is classified by the deepest matching known folder, never by a
// substring of the full URL and never by the product name.
const SOURCE_FOLDER_RULES: SourceFolderRule[] = [
  { folder: "comestics 12 22 25", category: "Cosmetics" },
  { folder: "ivoire market pictre2", category: "Ivoire Market" },
  { folder: "foods 12 22 25", category: "Foods" },
];

function decodeURIComponentSafe(value: string) {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

function normalizeSegment(value: string) {
  return decodeURIComponentSafe(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function folderSegments(folderOrPath: string) {
  const parts = decodeURIComponentSafe(String(folderOrPath ?? ""))
    .replace(/\\/g, "/")
    .split("/")
    .map((part) => part.trim())
    .filter(Boolean);
  const last = parts.at(-1) ?? "";
  return /\.[a-z0-9]{2,5}$/i.test(last) ? parts.slice(0, -1) : parts;
}

function ruleForSegment(segment: string): SourceFolderRule | null {
  const normalized = normalizeSegment(segment);
  return SOURCE_FOLDER_RULES.find((rule) => rule.folder === normalized) ?? null;
}

// Folder segments only. A trailing filename is dropped so a product is never
// classified by what its image file happens to be called.
export function canonicalCategoryFromSourceFolder(folderOrPath: string): SourceFolderCategory | null {
  const folders = folderSegments(folderOrPath);
  const matched = folders
    .map((segment) => ruleForSegment(segment))
    .filter((rule): rule is SourceFolderRule => Boolean(rule));
  const deepest = matched.at(-1);
  if (!deepest) return null;

  // `/images/Foods 12-22-25/<file>` is the parent wrapper, not the Foods source
  // folder. Foods products always live one level deeper, in a second folder of
  // the same name.
  const normalized = folders.map((segment) => normalizeSegment(segment));
  const imagesIndex = normalized.findIndex((segment) => segment === "images");
  if (deepest.category === "Foods" && imagesIndex >= 0) {
    const afterImages = normalized.slice(imagesIndex + 1);
    if (afterImages.length === 1 && afterImages[0] === "foods 12 22 25") return null;
  }

  return deepest.category;
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

// Import/reconciliation scripts may correct a product whose image folder and
// category_id disagree. They must not overwrite a matching assignment, and they
// must never classify from the product name.
export function shouldReconcileImportedCategory(input: {
  expectedFromSourceFolder: SourceFolderCategory | null;
  currentCategoryName: string | null | undefined;
}) {
  if (!input.expectedFromSourceFolder) return false;
  return input.currentCategoryName !== input.expectedFromSourceFolder;
}

export const SOURCE_FOLDER_CATEGORY_SLUG: Record<SourceFolderCategory, string> = {
  Cosmetics: "cosmetics",
  Foods: "foods",
  "Ivoire Market": "ivoire-market",
};
