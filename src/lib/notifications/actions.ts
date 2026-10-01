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
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;
  const { data } = await supabase
    .from("customer_announcements")
    .select("id, status, starts_at, ends_at, published_at, archived_at")
    .eq("status", "published");
  const now = Date.now();
  const live = (data ?? []).filter((row) => {
    if (row.archived_at) return false;
    if (row.starts_at && Date.parse(row.starts_at) > now) return false;
    if (row.ends_at && Date.parse(row.ends_at) <= now) return false;
    return Boolean(row.published_at);
  });
  if (live.length) {
    const stamp = new Date().toISOString();
    const { data: existing } = await supabase
      .from("customer_announcement_reads")
      .select("announcement_id, read_at")
      .eq("user_id", user.id)
      .in("announcement_id", live.map((row) => row.id));
    const alreadyRead = new Set((existing ?? []).filter((row) => row.read_at).map((row) => row.announcement_id));
    const pending = live.filter((row) => !alreadyRead.has(row.id));
    if (pending.length) {
      await supabase.from("customer_announcement_reads").upsert(
        pending.map((row) => ({ announcement_id: row.id, user_id: user.id, read_at: stamp })),
        { onConflict: "announcement_id,user_id" },
      );
    }
  }
}

export async function acknowledgeInboxItem(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  const kind = String(formData.get("kind") ?? "");
  const dismiss = String(formData.get("dismiss") ?? "") === "true";
  if (!uuid.test(id)) return;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;
  if (kind === "announcement") {
    const stamp = new Date().toISOString();
    const row: { announcement_id: string; user_id: string; read_at: string; dismissed_at?: string } = {
      announcement_id: id,
      user_id: user.id,
      read_at: stamp,
    };
    if (dismiss) row.dismissed_at = stamp;
    await supabase.from("customer_announcement_reads").upsert(row, { onConflict: "announcement_id,user_id" });
  } else {
    await supabase.from("customer_notifications").update({ read_at: new Date().toISOString() }).eq("id", id).eq("user_id", user.id).is("read_at", null);
  }
  revalidatePath("/account");
  revalidatePath("/account/notifications");
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
