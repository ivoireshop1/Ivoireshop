export type ProductAiSuggestion = {
  name: string | null;
  shortDescription: string | null;
  description: string | null;
  brand: string | null;
  packageSize: string | null;
  productType: string | null;
};

const EMPTY: ProductAiSuggestion = {
  name: null,
  shortDescription: null,
  description: null,
  brand: null,
  packageSize: null,
  productType: null,
};

const UNSUPPORTED_CLAIM =
  /\b(cure|cures|treats?|treatment|diagnos|medical|anti-?cancer|clinically proven|fda approved|guaranteed results)\b/i;

function cleanText(value: unknown, max: number) {
  if (typeof value !== "string") return null;
  const text = value.replace(/\s+/g, " ").trim();
  if (!text) return null;
  if (UNSUPPORTED_CLAIM.test(text)) return null;
  return text.slice(0, max);
}

export function emptyProductAiSuggestion(): ProductAiSuggestion {
  return { ...EMPTY };
}

export function sanitizeProductAiSuggestion(raw: unknown): ProductAiSuggestion {
  const source = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  return {
    name: cleanText(source.name ?? source.product_name ?? source.title, 120),
    shortDescription: cleanText(source.shortDescription ?? source.short_description ?? source.summary, 240),
    description: cleanText(source.description ?? source.product_description ?? source.longDescription, 2000),
    brand: cleanText(source.brand, 80),
    packageSize: cleanText(source.packageSize ?? source.package_size, 80),
    productType: cleanText(source.productType ?? source.product_type, 80),
  };
}

export function suggestionHasContent(suggestion: ProductAiSuggestion) {
  return Boolean(suggestion.name || suggestion.shortDescription || suggestion.description);
}

export function productAiSystemPrompt(categoryName: string) {
  return [
    "You identify grocery and household products from packaging photos for Ivoire Shop.",
    `The product is already categorized as ${categoryName}. Never change or suggest a different category.`,
    "Only use information clearly visible or reasonably identifiable on the packaging.",
    "Do not invent ingredients, nutrition facts, health or medical claims, country of origin, certifications, weight, size, brand, or manufacturer unless the image clearly shows them.",
    "If you are uncertain, omit the field (null).",
    "Do not invent a selling price, SKU, stock quantity, or published status.",
    "For cosmetics, never invent skin-treatment or medical claims.",
    "Descriptions should be professional e-commerce copy without unsupported claims.",
    "If the existing draft name looks useful, improve and normalize it instead of ignoring it.",
  ].join(" ");
}

export function productAiUserPrompt(input: { categoryName: string; draftName: string }) {
  return [
    `Known category (locked): ${input.categoryName}.`,
    `Existing draft name: ${input.draftName || "(none)"}.`,
    "Return JSON with keys name, shortDescription, description, brand, packageSize, productType.",
    "Use null for any field that is not clearly supported by the image.",
  ].join(" ");
}

export function parseProductAiJson(text: string): ProductAiSuggestion {
  const trimmed = String(text ?? "").trim();
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i)?.[1]?.trim();
  const block = fenced?.match(/\{[\s\S]*\}/)?.[0] ?? trimmed.match(/\{[\s\S]*\}/)?.[0];
  if (!block) return emptyProductAiSuggestion();
  try {
    return sanitizeProductAiSuggestion(JSON.parse(block));
  } catch {
    return emptyProductAiSuggestion();
  }
}
