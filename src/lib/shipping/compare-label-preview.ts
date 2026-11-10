"use server";

import { parseComparePackage, type CompareQuoteState, type PostageQuote } from "./compare-labels";

function closed() {
  return process.env.COMPARE_LABELS_PREVIEW !== "1";
}

export async function previewCompareQuotes(_state: CompareQuoteState | null, formData: FormData): Promise<CompareQuoteState> {
  if (closed()) return { error: "This preview is closed." };
  const parsed = parseComparePackage(formData);
  if (!parsed.ok) return { error: parsed.error };
  return {
    fingerprint: parsed.fingerprint,
    boxes: parsed.boxes.map((box) => ({
      boxId: box.id,
      quotes: [
        { boxId: box.id, carrier: "ups", service: "UPS Ground", postage: 18.4, days: 3, courierServiceId: "preview-ups-ground" },
        { boxId: box.id, carrier: "usps", service: "Ground Advantage", postage: 9.1, days: 4, courierServiceId: null },
      ] satisfies PostageQuote[],
    })),
  };
}

export async function previewPurchaseBlocked(): Promise<{ error: string; purchased: false }> {
  return { error: "UPS label purchases stay off until founder approval. The reviewed cost was not charged.", purchased: false };
}
