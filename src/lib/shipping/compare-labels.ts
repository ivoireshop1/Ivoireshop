export const PIRATE_SHIP_URL = "https://ship.pirateship.com/";
export const COMPARE_PROVIDER_GRID = "grid grid-cols-1 gap-4 lg:grid-cols-2";
export const COMPARE_SELECT_CLASS = "compare-selected motion-safe:animate-[compare-select_600ms_ease-out] motion-reduce:animate-none motion-reduce:bg-[#f3efe9]";

export type LabelCarrier = "ups" | "usps";

export type CompareBox = {
  id: string;
  weightLb: number;
  lengthIn: number;
  widthIn: number;
  heightIn: number;
};

export type CompareShipFrom = {
  name: string;
  address_line_1: string;
  city: string;
  state: string;
  postal_code: string;
  country: string;
};

export type PostageQuote = {
  boxId: string;
  carrier: LabelCarrier;
  service: string;
  postage: number;
  days: number | null;
  courierServiceId: string | null;
};

export type CompareQuoteState = {
  error?: string;
  unavailable?: boolean;
  fingerprint?: string;
  boxes?: Array<{ boxId: string; quotes: PostageQuote[] }>;
};

const ROUND = (value: number, places: number) => {
  const factor = 10 ** places;
  return Math.round(value * factor) / factor;
};

export function nextCompareBoxId(ids: string[]) {
  const used = new Set(ids);
  let number = ids.length + 1;
  while (used.has(`box-${number}`)) number += 1;
  return `box-${number}`;
}

export function compareLabelsEligible(order: { fulfillment_method?: string | null; fulfillment_provider?: string | null }) {
  const method = String(order.fulfillment_method ?? "");
  const provider = String(order.fulfillment_provider ?? "").toLowerCase();
  return method === "delivery" && (provider === "ups" || provider === "usps");
}

export function missingPackageDetails(boxes: CompareBox[]) {
  if (!boxes.length) return "Add at least one packed box before requesting quotes.";
  const incomplete = boxes.some((box) => !(box.weightLb > 0 && box.lengthIn > 0 && box.widthIn > 0 && box.heightIn > 0));
  return incomplete ? "Enter the actual packed weight and dimensions for every box." : null;
}

function needsState(country: string) {
  return country === "US" || country === "CA" || country === "MX" || country === "AU";
}

export function shipFromReady(origin: CompareShipFrom) {
  const country = origin.country.trim().toUpperCase();
  if (!origin.name.trim() || !origin.address_line_1.trim() || !origin.city.trim() || !origin.postal_code.trim() || country.length !== 2) {
    return "Confirm the ship-from name, street, city, postal code, and country.";
  }
  if (needsState(country) && !origin.state.trim()) return "Confirm the ship-from state.";
  return null;
}

export function quoteFingerprint(origin: CompareShipFrom, boxes: CompareBox[]) {
  return JSON.stringify({
    from: {
      name: origin.name.trim(),
      line1: origin.address_line_1.trim(),
      city: origin.city.trim(),
      state: origin.state.trim().toUpperCase(),
      postal: origin.postal_code.trim(),
      country: origin.country.trim().toUpperCase(),
    },
    boxes: boxes.map((box) => ({
      id: box.id,
      weightLb: ROUND(box.weightLb, 3),
      lengthIn: ROUND(box.lengthIn, 2),
      widthIn: ROUND(box.widthIn, 2),
      heightIn: ROUND(box.heightIn, 2),
    })),
  });
}

export function quotesAreStale(quotedFingerprint: string | null | undefined, currentFingerprint: string) {
  return !quotedFingerprint || quotedFingerprint !== currentFingerprint;
}

export function equivalentServiceKey(carrier: string, service: string) {
  return `${carrier.trim().toLowerCase()}::${service.trim().toLowerCase().replace(/\s+/g, " ")}`;
}

export function mapEasyshipBoxQuote(
  boxId: string,
  result: { ok: true; rates: Array<{ objectId?: string; provider: string; service: string; amount: number; estimatedDays: number | null }> } | { ok: false },
) {
  if (!result.ok) return { unavailable: true as const };
  const quotes = result.rates.flatMap((rate) => {
    if (rate.provider !== "ups" && rate.provider !== "usps") return [];
    if (!Number.isFinite(rate.amount) || rate.amount < 0 || !rate.service.trim()) return [];
    return [{
      boxId,
      carrier: rate.provider,
      service: rate.service.trim(),
      postage: ROUND(rate.amount, 2),
      days: typeof rate.estimatedDays === "number" && Number.isFinite(rate.estimatedDays) ? rate.estimatedDays : null,
      courierServiceId: rate.objectId?.trim() || null,
    } satisfies PostageQuote];
  });
  return { unavailable: false as const, quotes };
}

export function combineEasyshipBoxes(parts: Array<ReturnType<typeof mapEasyshipBoxQuote>>) {
  if (parts.some((part) => part.unavailable)) return "unavailable" as const;
  return parts.map((part) => part.quotes);
}

type PricedBox = { boxId: string; quotes: PostageQuote[] };

function completeTotal(boxIds: string[], rows: PricedBox[], key: string) {
  if (new Set(boxIds).size !== boxIds.length || rows.length !== boxIds.length) return null;
  let sum = 0;
  for (const boxId of boxIds) {
    const found = rows.filter((row) => row.boxId === boxId);
    if (found.length !== 1) return null;
    const matches = found[0].quotes.filter((quote) => equivalentServiceKey(quote.carrier, quote.service) === key);
    if (matches.length !== 1) return null;
    sum += matches[0].postage;
  }
  return ROUND(sum, 2);
}

export function fullOrderComparison(input: {
  boxIds: string[];
  easyship: PricedBox[] | "unavailable";
  pirate: PricedBox[];
}) {
  const keys = new Set<string>();
  const collect = (rows: PricedBox[]) => {
    for (const row of rows) {
      for (const quote of row.quotes) keys.add(equivalentServiceKey(quote.carrier, quote.service));
    }
  };
  if (input.easyship !== "unavailable") collect(input.easyship);
  collect(input.pirate);
  return [...keys].map((key) => {
    const easyshipTotal = input.easyship === "unavailable" ? null : completeTotal(input.boxIds, input.easyship, key);
    const pirateTotal = completeTotal(input.boxIds, input.pirate, key);
    const known = [easyshipTotal, pirateTotal].filter((value): value is number => value != null);
    return {
      key,
      easyshipTotal,
      pirateTotal,
      lowest: known.length ? Math.min(...known) : null,
    };
  });
}

export function isLowestKnown(total: number | null, lowest: number | null) {
  return total != null && lowest != null && Math.abs(total - lowest) < 0.015;
}

export function formatShippingAddress(address: {
  name?: string | null;
  address_line_1?: string | null;
  address_line_2?: string | null;
  city?: string | null;
  state?: string | null;
  postal_code?: string | null;
  country?: string | null;
}) {
  const cityLine = [address.city, address.state, address.postal_code].map((part) => String(part ?? "").trim()).filter(Boolean).join(" ");
  return [address.name, address.address_line_1, address.address_line_2, cityLine, address.country]
    .map((part) => String(part ?? "").trim())
    .filter(Boolean)
    .join("\n");
}

function csvCell(value: string | number) {
  let text = String(value);
  if (/^[=+\-@\t\r]/.test(text)) text = `'${text}`;
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

export function packageCsv(boxes: CompareBox[], address: Parameters<typeof formatShippingAddress>[0]) {
  const header = ["box", "weight_lb", "length_in", "width_in", "height_in", "ship_to_name", "ship_to_line_1", "ship_to_line_2", "ship_to_city", "ship_to_state", "ship_to_postal", "ship_to_country"];
  const lines = boxes.map((box, index) => [
    index + 1,
    box.weightLb,
    box.lengthIn,
    box.widthIn,
    box.heightIn,
    address.name ?? "",
    address.address_line_1 ?? "",
    address.address_line_2 ?? "",
    address.city ?? "",
    address.state ?? "",
    address.postal_code ?? "",
    address.country ?? "",
  ].map(csvCell).join(","));
  return `${header.join(",")}\n${lines.join("\n")}\n`;
}

export function easyshipPurchaseReady(input: {
  purchasesEnabled: boolean;
  verifiedUpsPurchase: boolean;
  selected: { carrier: LabelCarrier; service: string; postage: number; courierServiceId: string | null } | null;
  savedService: string | null;
  savedCourierServiceId: string | null;
  boxCount: number;
}) {
  if (!input.purchasesEnabled || !input.verifiedUpsPurchase || input.boxCount !== 1 || !input.selected) return false;
  if (input.selected.carrier !== "ups" || !(input.selected.postage >= 0)) return false;
  const saved = String(input.savedService ?? "").trim().toLowerCase();
  if (!saved || input.selected.service.trim().toLowerCase() !== saved) return false;
  if (input.savedCourierServiceId && input.selected.courierServiceId !== input.savedCourierServiceId) return false;
  return true;
}

export function parsePositive(value: unknown) {
  const amount = typeof value === "number" ? value : Number(String(value ?? "").trim());
  return Number.isFinite(amount) && amount > 0 ? amount : null;
}

export function parseComparePackage(formData: FormData): { ok: true; shipFrom: CompareShipFrom; boxes: CompareBox[]; fingerprint: string } | { ok: false; error: string } {
  const shipFrom: CompareShipFrom = {
    name: String(formData.get("ship_from_name") ?? "").trim(),
    address_line_1: String(formData.get("ship_from_line1") ?? "").trim(),
    city: String(formData.get("ship_from_city") ?? "").trim(),
    state: String(formData.get("ship_from_state") ?? "").trim(),
    postal_code: String(formData.get("ship_from_postal") ?? "").trim(),
    country: String(formData.get("ship_from_country") ?? "").trim(),
  };
  const originError = shipFromReady(shipFrom);
  if (originError) return { ok: false, error: originError };
  let raw: unknown;
  try {
    raw = JSON.parse(String(formData.get("boxes_json") ?? "").trim() || "[]");
  } catch {
    return { ok: false, error: "Enter the actual packed weight and dimensions for every box." };
  }
  if (!Array.isArray(raw)) return { ok: false, error: "Enter the actual packed weight and dimensions for every box." };
  if (raw.length > 8) return { ok: false, error: "Compare at most 8 boxes for one order." };
  const boxes: CompareBox[] = [];
  const seen = new Set<string>();
  for (const [index, row] of raw.entries()) {
    const record = row && typeof row === "object" ? row as Record<string, unknown> : {};
    const weightLb = parsePositive(record.weightLb);
    const lengthIn = parsePositive(record.lengthIn);
    const widthIn = parsePositive(record.widthIn);
    const heightIn = parsePositive(record.heightIn);
    if (weightLb == null || lengthIn == null || widthIn == null || heightIn == null) {
      return { ok: false, error: "Enter the actual packed weight and dimensions for every box." };
    }
    const id = String(record.id || `box-${index + 1}`).slice(0, 40);
    if (seen.has(id)) return { ok: false, error: "Each packed box needs its own id before it can be quoted." };
    seen.add(id);
    boxes.push({
      id,
      weightLb,
      lengthIn,
      widthIn,
      heightIn,
    });
  }
  const packageError = missingPackageDetails(boxes);
  if (packageError) return { ok: false, error: packageError };
  return { ok: true, shipFrom, boxes, fingerprint: quoteFingerprint(shipFrom, boxes) };
}
