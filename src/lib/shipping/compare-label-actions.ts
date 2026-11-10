"use server";

import { requireAdmin } from "@/src/lib/auth/guards";
import { quoteEasyshipRates } from "./easyship";
import {
  combineEasyshipBoxes,
  compareLabelsEligible,
  mapEasyshipBoxQuote,
  parseComparePackage,
  type CompareQuoteState,
} from "./compare-labels";

function text(formData: FormData, name: string) {
  return String(formData.get(name) ?? "").trim();
}

function destinationOf(order: { shipping_address?: unknown; customer_name?: string | null }) {
  const row = order.shipping_address && typeof order.shipping_address === "object" ? order.shipping_address as Record<string, unknown> : {};
  return {
    name: String(row.name ?? order.customer_name ?? ""),
    address_line_1: String(row.address_line_1 ?? ""),
    address_line_2: String(row.address_line_2 ?? ""),
    city: String(row.city ?? ""),
    state: String(row.state ?? ""),
    postal_code: String(row.postal_code ?? ""),
    country: String(row.country ?? ""),
  };
}

export async function refreshCompareLabelQuotes(_state: CompareQuoteState | null, formData: FormData): Promise<CompareQuoteState> {
  const { supabase } = await requireAdmin();
  const orderId = text(formData, "order_id");
  const { data: order } = await supabase
    .from("orders")
    .select("id, fulfillment_method, fulfillment_provider, shipping_address, customer_name")
    .eq("id", orderId)
    .maybeSingle();
  if (!order || !compareLabelsEligible(order)) {
    return { error: "Compare & Buy Labels is only for UPS and USPS parcel orders." };
  }
  const parsed = parseComparePackage(formData);
  if (!parsed.ok) return { error: parsed.error, fingerprint: undefined };
  const { data: items } = await supabase
    .from("order_items")
    .select("product_name, product_price, quantity")
    .eq("order_id", orderId);
  const products = (items ?? []).map((item) => ({
    quantity: Number(item.quantity ?? 1),
    price: item.product_price,
    description: String(item.product_name ?? "Ivoire Shop item"),
  }));
  const destination = destinationOf(order);
  const parts = [];
  for (const box of parsed.boxes) {
    const quoted = await quoteEasyshipRates({
      origin: parsed.shipFrom,
      destination,
      parcel: box,
      products,
    });
    const mapped = mapEasyshipBoxQuote(box.id, quoted.ok
      ? { ok: true, rates: quoted.rates }
      : { ok: false });
    parts.push(mapped);
    if (mapped.unavailable) {
      return { unavailable: true, fingerprint: parsed.fingerprint, boxes: [] };
    }
  }
  const combined = combineEasyshipBoxes(parts);
  if (combined === "unavailable") return { unavailable: true, fingerprint: parsed.fingerprint, boxes: [] };
  return {
    unavailable: false,
    fingerprint: parsed.fingerprint,
    boxes: parsed.boxes.map((box, index) => ({ boxId: box.id, quotes: combined[index] ?? [] })),
  };
}
