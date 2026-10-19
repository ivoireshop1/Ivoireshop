import { createClient } from "@/src/lib/supabase/server";

export type ShippingMonitorEventType =
  | "quote_failure"
  | "missing_parcel"
  | "shipping_exception"
  | "checkout_quote"
  | "label_blocked";

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

export function summarizeShippingEvents(rows: Array<{ event_type: string; payload: Record<string, unknown> | null; created_at: string }>) {
  const counts: Record<string, number> = {};
  for (const row of rows) counts[row.event_type] = (counts[row.event_type] ?? 0) + 1;
  return {
    total: rows.length,
    quoteFailures: counts.quote_failure ?? 0,
    missingParcel: counts.missing_parcel ?? 0,
    exceptions: counts.shipping_exception ?? 0,
    quotes: counts.checkout_quote ?? 0,
    labelsBlocked: counts.label_blocked ?? 0,
    latestAt: rows[0]?.created_at ?? null,
  };
}
