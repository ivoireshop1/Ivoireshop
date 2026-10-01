import "server-only";

import { requireAdmin } from "@/src/lib/auth/guards";
import { displayAnnouncementStatus, type CustomerAnnouncement } from "@/src/lib/admin/announcement-helpers";
import { recordAdminIncident } from "@/src/lib/ops/incident";

export type { AnnouncementStatus, CustomerAnnouncement } from "@/src/lib/admin/announcement-helpers";
export { displayAnnouncementStatus, sanitizeAnnouncementPath, toDatetimeLocalValue } from "@/src/lib/admin/announcement-helpers";

export async function listAdminAnnouncements(): Promise<
  { ok: true; items: CustomerAnnouncement[] } | { ok: false; incidentId: string }
> {
  const { supabase } = await requireAdmin();
  try {
    const { data, error } = await supabase
      .from("customer_announcements")
      .select("id, title, message, action_label, action_href, audience, status, starts_at, ends_at, published_at, archived_at, created_at, updated_at")
      .order("updated_at", { ascending: false });
    if (error) {
      const incident = recordAdminIncident({
        route: "/admin/announcements",
        feature: "announcement_list",
        category: "database",
        safeCode: "ADM-ANNOUNCEMENTS-LOAD",
      });
      return { ok: false, incidentId: incident.id };
    }
    return { ok: true, items: (data ?? []) as CustomerAnnouncement[] };
  } catch (caught) {
    const digest = typeof caught === "object" && caught && "digest" in caught ? String((caught as { digest?: string }).digest) : "";
    if (digest.startsWith("NEXT_REDIRECT") || digest.startsWith("NEXT_HTTP")) throw caught;
    const incident = recordAdminIncident({
      route: "/admin/announcements",
      feature: "announcement_list",
      category: "unknown",
      safeCode: "ADM-ANNOUNCEMENTS-LOAD",
    });
    return { ok: false, incidentId: incident.id };
  }
}

export function announcementDashboardCounts(rows: CustomerAnnouncement[]) {
  const now = new Date();
  const statuses = rows.map((row) => displayAnnouncementStatus(row, now));
  return {
    published: statuses.filter((status) => status === "published").length,
    scheduled: statuses.filter((status) => status === "scheduled").length,
    drafts: statuses.filter((status) => status === "draft").length,
    recentlyPublished: rows.filter((row) => row.published_at && Date.now() - new Date(row.published_at).getTime() < 1000 * 60 * 60 * 24 * 14).length,
  };
}

