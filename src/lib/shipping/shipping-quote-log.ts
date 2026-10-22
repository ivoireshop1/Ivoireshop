export const SHIPPING_QUOTE_LOG_STATUSES = [
  "ok",
  "no_rate",
  "error",
  "missing_weight",
  "missing_box",
  "missing_parcel",
  "oversized",
  "overweight",
  "capacity_exceeded",
] as const;

export type ShippingQuoteLogStatus = (typeof SHIPPING_QUOTE_LOG_STATUSES)[number];

export type ShippingQuoteLogInput = {
  usedEstimatedWeight: boolean;
  usedEstimatedBox?: boolean;
  weightSources: unknown;
  parcel?: {
    weightLb?: number;
    lengthIn?: number;
    widthIn?: number;
    heightIn?: number;
    estimatedBox?: boolean;
    boxId?: string | null;
    boxName?: string | null;
    unknownItemDimensions?: boolean;
    parcels?: Array<{
      weightLb: number;
      lengthIn: number;
      widthIn: number;
      heightIn: number;
      estimatedBox?: boolean;
      boxId?: string | null;
      boxName?: string | null;
      unknownItemDimensions?: boolean;
    }>;
  } | null;
  message?: string | null;
  status?: string | null;
};

type QuoteLogClient = {
  from: (table: string) => {
    insert: (row: Record<string, unknown>) => PromiseLike<{ error: { message?: string; code?: string } | null }>;
  };
};

export function shippingQuoteLogStatus(value?: string | null): ShippingQuoteLogStatus {
  return SHIPPING_QUOTE_LOG_STATUSES.includes(value as ShippingQuoteLogStatus)
    ? (value as ShippingQuoteLogStatus)
    : "ok";
}

export function parcelUsedEstimatedBox(parcel: ShippingQuoteLogInput["parcel"] | unknown) {
  if (!parcel || typeof parcel !== "object") return false;
  const row = parcel as { estimatedBox?: boolean; parcels?: Array<{ estimatedBox?: boolean }> };
  if (row.estimatedBox) return true;
  return Array.isArray(row.parcels) && row.parcels.some((item) => item.estimatedBox);
}

export function shippingQuoteLogRow(input: ShippingQuoteLogInput) {
  const parcel = input.parcel
    ? { ...input.parcel, usedEstimatedBox: Boolean(input.usedEstimatedBox ?? parcelUsedEstimatedBox(input.parcel)) }
    : null;
  return {
    used_estimated_weight: Boolean(input.usedEstimatedWeight),
    weight_sources: input.weightSources ?? [],
    parcel,
    message: input.message ?? null,
    status: shippingQuoteLogStatus(input.status),
  };
}

export async function recordShippingQuoteLog(
  input: ShippingQuoteLogInput,
  supabase: QuoteLogClient,
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const { error } = await supabase.from("shipping_quote_logs").insert(shippingQuoteLogRow(input));
    if (error) {
      console.error("[shipping-quote-log] insert failed", {
        message: error.message ?? "unknown",
        code: error.code ?? null,
      });
      return { ok: false, error: error.message ?? "insert failed" };
    }
    return { ok: true };
  } catch (error) {
    console.error("[shipping-quote-log] insert failed", {
      detail: error instanceof Error ? error.message.slice(0, 180) : "unknown",
    });
    return { ok: false, error: error instanceof Error ? error.message : "insert failed" };
  }
}
