"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/src/lib/supabase/server";

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function markRead(orderId: string | null) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;
  await supabase.rpc("mark_customer_notifications_read", { p_order_id: orderId });
  revalidatePath("/account");
  revalidatePath("/account/notifications");
  if (orderId) revalidatePath(`/account/orders/${orderId}`);
}

export async function markAllNotificationsRead() {
  await markRead(null);
}

export async function markNotificationOrderRead(orderId: string) {
  if (!uuid.test(orderId)) return;
  await markRead(orderId);
}

export async function markOneNotificationRead(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  if (!uuid.test(id)) return;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;
  await supabase
    .from("customer_notifications")
    .update({ read_at: new Date().toISOString() })
    .eq("id", id)
    .eq("user_id", user.id)
    .is("read_at", null);
  revalidatePath("/account");
  revalidatePath("/account/notifications");
}
