import "server-only";

import { requireAdmin } from "@/src/lib/auth/guards";
import { displayAnnouncementStatus, type AnnouncementStatus } from "@/src/lib/admin/announcement-helpers";
import { recordAdminIncident } from "@/src/lib/ops/incident";

export type { AnnouncementStatus } from "@/src/lib/admin/announcement-helpers";
export { displayAnnouncementStatus, sanitizeAnnouncementPath } from "@/src/lib/admin/announcement-helpers";

export type CustomerAnnouncement = {
  id: string;
  title: string;
  message: string;
  action_label: string | null;
  action_href: string | null;
  audience: string;
  status: AnnouncementStatus;
  starts_at: string | null;
  ends_at: string | null;
  published_at: string | null;
  archived_at: string | null;
  created_at: string;
  updated_at: string;
};

export async function listAdminAnnouncements(): Promise<
  { ok: true; items: CustomerAnnouncement[] } | { ok: false; incidentId: string }
> {
  const { supabase } = await requireAdmin();
  const { data, error } = await supabase
    .from("customer_announcements")
    .select("id, title, message, action_label, action_href, audience, status, starts_at, ends_at, published_at, archived_at, created_at, updated_at")
    .order("updated_at", { ascending: false });
  if (error) {
    const incident = recordAdminIncident({
      route: "/admin/announcements",
      feature: "announcement_list",
      category: "database",
      safeCode: "ANNOUNCEMENT_LOAD",
    });
    return { ok: false, incidentId: incident.id };
  }
  return { ok: true, items: (data ?? []) as CustomerAnnouncement[] };
}

export async function announcementDashboardCounts(rows: CustomerAnnouncement[]) {
  const now = new Date();
  const statuses = rows.map((row) => displayAnnouncementStatus(row, now));
  return {
    published: statuses.filter((status) => status === "published").length,
    scheduled: statuses.filter((status) => status === "scheduled").length,
    drafts: statuses.filter((status) => status === "draft").length,
    recentlyPublished: rows.filter((row) => row.published_at && Date.now() - new Date(row.published_at).getTime() < 1000 * 60 * 60 * 24 * 14).length,
  };
}

export function toDatetimeLocalValue(iso: string | null | undefined) {
  if (!iso) return "";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return date.toISOString().slice(0, 16);
}
