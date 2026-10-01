import "server-only";

import { createClient } from "@/src/lib/supabase/server";
import { displayAnnouncementStatus, type AnnouncementStatusSource } from "@/src/lib/admin/announcement-helpers";
import type { CustomerNotification } from "./record";
import type { InboxItem } from "./inbox-item";

export type { InboxItem } from "./inbox-item";

function liveAnnouncement(row: AnnouncementStatusSource, now: Date) {
  return displayAnnouncementStatus(row, now) === "published";
}

export async function getCustomerInbox(limit = 50) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { kind: "unauthenticated" as const };
  const [{ data: notes, error: notesError }, { data: announcements, error: announcementError }, { data: reads }] = await Promise.all([
    supabase
      .from("customer_notifications")
      .select("id, order_id, event_type, title, message, confirmation_code, email_sent, email_attempted, read_at, created_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(limit),
    supabase
      .from("customer_announcements")
      .select("id, title, message, action_label, action_href, audience, status, starts_at, ends_at, published_at, archived_at, created_at, updated_at")
      .order("published_at", { ascending: false })
      .limit(80),
    supabase
      .from("customer_announcement_reads")
      .select("announcement_id, read_at, dismissed_at")
      .eq("user_id", user.id),
  ]);
  if (notesError && announcementError) {
    return { kind: "found" as const, items: [] as InboxItem[] };
  }
  const readMap = new Map((reads ?? []).map((row) => [row.announcement_id, row]));
  const now = new Date();
  const announcementItems: InboxItem[] = ((announcementError ? [] : announcements ?? []) as Array<AnnouncementStatusSource & { id: string; title: string; message: string; action_label: string | null; action_href: string | null; published_at: string | null; created_at: string }>)
    .filter((row) => liveAnnouncement(row, now) || readMap.has(row.id))
    .map((row) => {
      const receipt = readMap.get(row.id);
      return {
        id: row.id,
        kind: "announcement" as const,
        title: row.title,
        message: row.message,
        created_at: row.published_at || row.created_at,
        read_at: receipt?.read_at ?? null,
        dismissed_at: receipt?.dismissed_at ?? null,
        event_type: "announcement",
        action_label: row.action_label,
        action_href: row.action_href,
      };
    });
  const orderItems: InboxItem[] = ((notesError ? [] : notes ?? []) as CustomerNotification[]).map((row) => ({
    id: row.id,
    kind: "order" as const,
    title: row.title,
    message: row.message,
    created_at: row.created_at,
    read_at: row.read_at,
    order_id: row.order_id,
    confirmation_code: row.confirmation_code,
    event_type: row.event_type,
  }));
  const items = [...orderItems, ...announcementItems].sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at)).slice(0, limit);
  return { kind: "found" as const, items };
}

export async function getUnreadInboxCount() {
  const result = await getCustomerInbox(80);
  if (result.kind !== "found") return 0;
  return result.items.filter((item) => !item.read_at && !item.dismissed_at).length;
}

export async function getProminentInboxItem() {
  const result = await getCustomerInbox(20);
  if (result.kind !== "found") return null;
  return result.items.find((item) => !item.read_at && !item.dismissed_at) ?? null;
}
