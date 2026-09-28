import "server-only";

import { createClient } from "@/src/lib/supabase/server";
import type { CustomerNotification } from "./record";

export async function getCustomerNotifications(limit = 50) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { kind: "unauthenticated" as const };
  const { data, error } = await supabase
    .from("customer_notifications")
    .select("id, order_id, event_type, title, message, confirmation_code, email_sent, email_attempted, read_at, created_at")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw new Error("Unable to load your notifications.");
  return { kind: "found" as const, notifications: (data ?? []) as CustomerNotification[] };
}

export async function getUnreadNotificationCount() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return 0;
  const { count, error } = await supabase
    .from("customer_notifications")
    .select("id", { count: "exact", head: true })
    .eq("user_id", user.id)
    .is("read_at", null);
  if (error) return 0;
  return count ?? 0;
}

export async function markOrderNotificationsSeen(orderId: string) {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(orderId)) return;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;
  try {
    await supabase.rpc("mark_customer_notifications_read", { p_order_id: orderId });
  } catch {
    /* Opening the order must not fail because a notification flag could not update. */
  }
}
