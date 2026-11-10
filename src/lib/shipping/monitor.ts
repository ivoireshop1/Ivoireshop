import { createClient } from "@/src/lib/supabase/server";
import { isAiWeightSource } from "@/src/lib/catalog/shipping-weight";
import { recordShippingQuoteLog as writeShippingQuoteLog, type ShippingQuoteLogInput } from "./shipping-quote-log";

export { summarizeShippingEvents } from "./monitor-summary";

export type ShippingMonitorEventType =
  | "quote_failure"
  | "missing_parcel"
  | "shipping_exception"
  | "checkout_quote"
  | "label_blocked"
  | "rate_table_fallback";

export async function recordShippingMonitorEvent(
  eventType: ShippingMonitorEventType,
  payload: Record<string, unknown>,
) {
  try {
    const supabase = await createClient();
    await supabase.from("shipping_monitor_events").insert({
      event_type: eventType,
      payload,
    });
  } catch {
    console.info("[shipping-monitor]", { eventType });
  }
}

export async function recordShippingQuoteLog(input: ShippingQuoteLogInput) {
  try {
    const supabase = await createClient();
    await writeShippingQuoteLog(input, supabase);
  } catch (error) {
    console.error("[shipping-quote-log] insert failed", {
      detail: error instanceof Error ? error.message.slice(0, 180) : "unknown",
    });
  }
}

export function cartUsesEstimatedWeight(products: Array<{ weight_source?: string | null }>) {
  return products.some((product) => isAiWeightSource(product.weight_source));
}
