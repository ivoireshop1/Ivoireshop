import { ESTIMATE_WEIGHT_BUFFER } from "./estimate-rules.ts";

export type EstimatedPackagePreset = {
  id: string;
  name: string;
  lengthIn: number;
  widthIn: number;
  heightIn: number;
  maxWeightLb: number;
  tareWeightLb: number;
  isActive: boolean;
  estimated: true;
};

/** Configurable estimated cartons. Not measured and not carrier-approved. */
export const ESTIMATED_PACKAGING_PRESETS: EstimatedPackagePreset[] = [
  { id: "estimate-small-mailer", name: "Estimated small padded mailer/box", lengthIn: 10, widthIn: 8, heightIn: 4, maxWeightLb: 2, tareWeightLb: 0, isActive: true, estimated: true },
  { id: "estimate-small-box", name: "Estimated small box", lengthIn: 12, widthIn: 10, heightIn: 6, maxWeightLb: 5, tareWeightLb: 0, isActive: true, estimated: true },
  { id: "estimate-medium-box", name: "Estimated medium box", lengthIn: 16, widthIn: 12, heightIn: 10, maxWeightLb: 15, tareWeightLb: 0, isActive: true, estimated: true },
  { id: "estimate-large-box", name: "Estimated large box", lengthIn: 20, widthIn: 16, heightIn: 12, maxWeightLb: 30, tareWeightLb: 0, isActive: true, estimated: true },
  { id: "estimate-heavy-box", name: "Estimated heavy/bag box", lengthIn: 26, widthIn: 18, heightIn: 10, maxWeightLb: 50, tareWeightLb: 0, isActive: true, estimated: true },
];

export function isEstimatedPackageId(id?: string | null) {
  return String(id ?? "").startsWith("estimate-");
}

export function withEstimateAllowanceLb(weightLb: number, alreadyBuffered: boolean) {
  if (!(weightLb > 0)) return weightLb;
  if (alreadyBuffered) return Number(weightLb.toFixed(3));
  return Number((weightLb * ESTIMATE_WEIGHT_BUFFER).toFixed(3));
}
