import { createClient } from "@/src/lib/supabase/server";

export { summarizeShippingEvents } from "./monitor-summary";

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
