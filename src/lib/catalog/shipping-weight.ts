import { parsePositive } from "../delivery/package.ts";

export type WeightSource = "verified" | "ai_text" | "ai_image" | "ai_estimate";
export type WeightConfidence = "high" | "medium" | "low";
export type AiWeightOrigin = "text" | "image" | "estimate";
export type ShippingDims = { lengthIn: number; widthIn: number; heightIn: number };

const ESTIMATE_BUFFER = 1.1;

export function estimatedWeightsAllowed(env: NodeJS.ProcessEnv = process.env) {
  const raw = String(env.ALLOW_ESTIMATED_WEIGHTS ?? "true").trim().toLowerCase();
  return raw !== "0" && raw !== "false" && raw !== "off" && raw !== "no";
}

export function parseWeightSource(value: unknown): WeightSource | null {
  if (value === "verified" || value === "ai_text" || value === "ai_image" || value === "ai_estimate") return value;
  return null;
}

export function parseWeightConfidence(value: unknown): WeightConfidence | null {
  if (value === "high" || value === "medium" || value === "low") return value;
  return null;
}

export function isAiWeightSource(source?: string | null) {
  return source === "ai_text" || source === "ai_image" || source === "ai_estimate";
}

export function mapAiOriginToSource(origin?: string | null): WeightSource {
  if (origin === "text") return "ai_text";
  if (origin === "image") return "ai_image";
  return "ai_estimate";
}

export function ozToLb(oz: number) {
  return Number((oz / 16).toFixed(3));
}

export function lbToOz(lb: number) {
  return Number((lb * 16).toFixed(3));
}

export function parseDims(value: unknown): ShippingDims | null {
  if (!value || typeof value !== "object") return null;
  const row = value as Record<string, unknown>;
  const lengthIn = parsePositive(row.length_in ?? row.lengthIn);
  const widthIn = parsePositive(row.width_in ?? row.widthIn);
  const heightIn = parsePositive(row.height_in ?? row.heightIn);
  if (!lengthIn || !widthIn || !heightIn) return null;
  return { lengthIn, widthIn, heightIn };
}

function unitToOz(amount: number, unit: string) {
  const key = unit.toLowerCase();
  if (key === "oz" || key === "ounce" || key === "ounces") return amount;
  if (key === "lb" || key === "lbs" || key === "pound" || key === "pounds") return amount * 16;
  if (key === "kg" || key === "kgs") return amount * 35.274;
  if (key === "g" || key === "gram" || key === "grams") return amount * 0.035274;
  if (key === "l" || key === "liter" || key === "litre" || key === "liters" || key === "litres") return amount * 35.274;
  if (key === "ml") return amount * 0.035274;
  return null;
}

export function extractWeightOzFromText(text: string) {
  const source = String(text ?? "").replace(/,/g, "");
  if (!source.trim()) return null;
  const pack = source.match(/(\d+(?:\.\d+)?)\s*(?:x|×)\s*(\d+(?:\.\d+)?)\s*(lb|lbs|pounds?|oz|ounces?|kg|kgs|g|grams?|l|liters?|litres?|ml)\b/i);
  if (pack) {
    const count = Number(pack[1]);
    const unitAmount = Number(pack[2]);
    const oz = unitToOz(unitAmount, pack[3]);
    if (count > 0 && oz && oz > 0) {
      return {
        weightOz: Number((count * oz).toFixed(3)),
        reasoning: `Multi-pack ${count} × ${unitAmount} ${pack[3]}`,
      };
    }
  }
  const single = source.match(/(\d+(?:\.\d+)?)\s*(lb|lbs|pounds?|oz|ounces?|kg|kgs|g|grams?)\b/i);
  if (!single) return null;
  const oz = unitToOz(Number(single[1]), single[2]);
  if (!oz || oz <= 0) return null;
  return {
    weightOz: Number(oz.toFixed(3)),
    reasoning: `Extracted ${single[1]} ${single[2]} from catalog text`,
  };
}

export function productHasUsableShippingWeight(product: {
  weight_oz?: number | string | null;
  item_weight_lb?: number | string | null;
  weight_source?: string | null;
}, env: NodeJS.ProcessEnv = process.env) {
  const quoted = quoteUnitWeightLb(product, env);
  return quoted != null;
}

export function quoteUnitWeightLb(product: {
  weight_oz?: number | string | null;
  item_weight_lb?: number | string | null;
  packaging_weight_oz?: number | string | null;
  package_weight_lb?: number | string | null;
  weight_source?: string | null;
}, env: NodeJS.ProcessEnv = process.env) {
  const source = parseWeightSource(product.weight_source);
  const allowEstimated = estimatedWeightsAllowed(env);
  if (isAiWeightSource(source) && !allowEstimated) return null;
  const itemOz = parsePositive(product.weight_oz)
    ?? (parsePositive(product.item_weight_lb) != null ? lbToOz(Number(product.item_weight_lb)) : null);
  if (itemOz == null || itemOz <= 0) return null;
  const packOz = parsePositive(product.packaging_weight_oz)
    ?? (parsePositive(product.package_weight_lb) != null ? lbToOz(Number(product.package_weight_lb)) : 0);
  const packedOz = itemOz + (packOz ?? 0);
  const buffered = isAiWeightSource(source) ? packedOz * ESTIMATE_BUFFER : packedOz;
  return ozToLb(buffered);
}

export function canPersistEstimatedShippingWeight(existing?: { weight_source?: string | null } | null) {
  return parseWeightSource(existing?.weight_source) !== "verified";
}

export function shippingPatchFromSuggestion(input: {
  weightOz: number;
  lengthIn?: number | null;
  widthIn?: number | null;
  heightIn?: number | null;
  source: WeightSource;
  confidence: WeightConfidence;
  packagingWeightOz?: number | null;
}) {
  const dims = input.lengthIn && input.widthIn && input.heightIn
    ? { length_in: input.lengthIn, width_in: input.widthIn, height_in: input.heightIn }
    : null;
  return {
    weight_oz: Number(input.weightOz.toFixed(3)),
    packaging_weight_oz: input.packagingWeightOz != null ? Number(input.packagingWeightOz.toFixed(3)) : null,
    weight_source: input.source,
    weight_confidence: input.confidence,
    dims,
    item_weight_lb: ozToLb(input.weightOz),
    package_weight_lb: input.packagingWeightOz != null ? ozToLb(input.packagingWeightOz) : null,
    ship_length_in: dims?.length_in ?? null,
    ship_width_in: dims?.width_in ?? null,
    ship_height_in: dims?.height_in ?? null,
  };
}

export function weightSourceBadge(source?: string | null, confidence?: string | null) {
  if (source === "verified") return { label: "Verified", tone: "verified" as const };
  if (source === "ai_text") return { label: `AI text${confidence ? ` · ${confidence}` : ""}`, tone: "ai" as const };
  if (source === "ai_image") return { label: `AI image${confidence ? ` · ${confidence}` : ""}`, tone: "ai" as const };
  if (source === "ai_estimate") return { label: `AI estimate${confidence ? ` · ${confidence}` : ""}`, tone: "estimate" as const };
  return { label: "No shipping weight", tone: "missing" as const };
}
