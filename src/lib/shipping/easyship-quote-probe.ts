export const EASYSHIP_PRODUCTION_QUOTE_CONFIRM = "request-one-easyship-production-quote";
export const EASYSHIP_PROBE_COOLDOWN_MS = 120_000;
export const EASYSHIP_PROBE_LIMITS = {
  minWeightLb: 0.05,
  maxWeightLb: 150,
  minDimIn: 1,
  maxDimIn: 108,
  minDeclared: 0.5,
  maxDeclared: 5000,
};

const lastProbeAtByAdmin = new Map<string, number>();

export function easyshipProbeCooldownRemaining(lastAt: number | null | undefined, now = Date.now()) {
  if (!lastAt || lastAt > now) return 0;
  return Math.max(0, lastAt + EASYSHIP_PROBE_COOLDOWN_MS - now);
}

export function rememberEasyshipProbe(adminId: string, at = Date.now()) {
  lastProbeAtByAdmin.set(adminId, at);
}

export function easyshipProbeRemainingForAdmin(adminId: string, extraLastAt?: number | null, now = Date.now()) {
  return easyshipProbeCooldownRemaining(Math.max(lastProbeAtByAdmin.get(adminId) ?? 0, extraLastAt ?? 0), now);
}

export type EasyshipQuoteProbeDraft = {
  confirm: string;
  acknowledged: boolean;
  parcel: { weightLb: number; lengthIn: number; widthIn: number; heightIn: number } | null;
  destination: {
    address_line_1: string;
    city: string;
    state: string;
    postal_code: string;
    country: string;
  };
  declaredValue: number | null;
  description: string;
};

function positiveNumber(raw: FormDataEntryValue | null) {
  const text = String(raw ?? "").trim();
  if (!text) return null;
  const value = Number(text);
  return Number.isFinite(value) && value > 0 ? value : null;
}

export function parseEasyshipQuoteProbeDraft(formData: FormData): EasyshipQuoteProbeDraft {
  const weightLb = positiveNumber(formData.get("weight_lb"));
  const lengthIn = positiveNumber(formData.get("length_in"));
  const widthIn = positiveNumber(formData.get("width_in"));
  const heightIn = positiveNumber(formData.get("height_in"));
  return {
    confirm: String(formData.get("confirm") ?? "").trim(),
    acknowledged: formData.get("acknowledge") === "on",
    parcel: weightLb != null && lengthIn != null && widthIn != null && heightIn != null
      ? { weightLb, lengthIn, widthIn, heightIn }
      : null,
    destination: {
      address_line_1: String(formData.get("dest_line_1") ?? "").trim(),
      city: String(formData.get("dest_city") ?? "").trim(),
      state: String(formData.get("dest_state") ?? "").trim(),
      postal_code: String(formData.get("dest_postal") ?? "").trim(),
      country: String(formData.get("dest_country") ?? "US").trim() || "US",
    },
    declaredValue: positiveNumber(formData.get("declared_value")),
    description: String(formData.get("description") ?? "").trim() || "Ivoire Shop grocery item",
  };
}

export function easyshipQuoteProbeBlocker(draft: EasyshipQuoteProbeDraft) {
  if (!draft.acknowledged) return "Confirm that this request uses one Easyship production API call.";
  if (draft.confirm !== EASYSHIP_PRODUCTION_QUOTE_CONFIRM) {
    return `Type ${EASYSHIP_PRODUCTION_QUOTE_CONFIRM} to request one production quote.`;
  }
  if (!draft.parcel) return "Enter verified packed weight and box measurements. Missing values are never invented.";
  const { minWeightLb, maxWeightLb, minDimIn, maxDimIn, minDeclared, maxDeclared } = EASYSHIP_PROBE_LIMITS;
  if (draft.parcel.weightLb < minWeightLb || draft.parcel.weightLb > maxWeightLb) {
    return `Packed weight must be a realistic measured value between ${minWeightLb} and ${maxWeightLb} lb.`;
  }
  if ([draft.parcel.lengthIn, draft.parcel.widthIn, draft.parcel.heightIn].some((dim) => dim < minDimIn || dim > maxDimIn)) {
    return `Box dimensions must be realistic measured values between ${minDimIn} and ${maxDimIn} in.`;
  }
  if (!draft.declaredValue) return "Enter the item selling price as the declared value. Prices are never invented.";
  if (draft.declaredValue < minDeclared || draft.declaredValue > maxDeclared) {
    return `Declared value must be the real selling price, between $${minDeclared.toFixed(2)} and $${maxDeclared.toFixed(0)}.`;
  }
  const dest = draft.destination;
  if (
    dest.address_line_1.length < 5
    || dest.city.length < 2
    || dest.state.length < 2
    || dest.postal_code.length < 5
    || dest.country.length < 2
  ) {
    return "Enter a complete real destination address. Addresses are never invented.";
  }
  return null;
}
