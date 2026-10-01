import "server-only";

import { requireAdmin } from "@/src/lib/auth/guards";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { displayAnnouncementStatus, sanitizeAnnouncementPath, type AnnouncementStatus } from "@/src/lib/admin/announcement-helpers";

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

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function revalidateAnnouncements() {
  revalidatePath("/admin");
  revalidatePath("/admin/announcements");
  revalidatePath("/account");
  revalidatePath("/account/notifications");
}

export async function listAdminAnnouncements() {
  const { supabase } = await requireAdmin();
  const { data, error } = await supabase
    .from("customer_announcements")
    .select("id, title, message, action_label, action_href, audience, status, starts_at, ends_at, published_at, archived_at, created_at, updated_at")
    .order("updated_at", { ascending: false });
  if (error) throw new Error("Unable to load announcements.");
  return (data ?? []) as CustomerAnnouncement[];
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

function readAnnouncementForm(formData: FormData) {
  const title = String(formData.get("title") ?? "").trim().slice(0, 160);
  const message = String(formData.get("message") ?? "").trim().slice(0, 4000);
  const action_label = String(formData.get("action_label") ?? "").trim().slice(0, 80) || null;
  const action_href = sanitizeAnnouncementPath(String(formData.get("action_href") ?? ""));
  const starts_at = String(formData.get("starts_at") ?? "").trim() || null;
  const ends_at = String(formData.get("ends_at") ?? "").trim() || null;
  if (!title || !message) return { error: "title" as const };
  if (String(formData.get("action_href") ?? "").trim() && !action_href) return { error: "href" as const };
  return {
    title,
    message,
    action_label,
    action_href,
    starts_at: starts_at ? new Date(starts_at).toISOString() : null,
    ends_at: ends_at ? new Date(ends_at).toISOString() : null,
  };
}

export async function createCustomerAnnouncement(formData: FormData) {
  const { supabase } = await requireAdmin();
  const parsed = readAnnouncementForm(formData);
  if ("error" in parsed) {
    redirect(parsed.error === "href" ? "/admin/announcements?error=href" : "/admin/announcements?error=required");
  }
  const values = parsed;
  const asDraft = formData.get("intent") !== "publish";
  const { data: { user } } = await supabase.auth.getUser();
  const starts = values.starts_at ? new Date(values.starts_at) : null;
  const scheduled = Boolean(starts && starts.getTime() > Date.now());
  const { error } = await supabase.from("customer_announcements").insert({
    ...values,
    audience: "all_customers",
    status: asDraft ? "draft" : scheduled ? "scheduled" : "published",
    published_at: asDraft ? null : new Date().toISOString(),
    created_by: user?.id ?? null,
  });
  if (error) redirect("/admin/announcements?error=save");
  revalidateAnnouncements();
  redirect("/admin/announcements?success=saved");
}

export async function updateCustomerAnnouncement(formData: FormData) {
  const { supabase } = await requireAdmin();
  const id = String(formData.get("id") ?? "");
  if (!uuid.test(id)) redirect("/admin/announcements?error=save");
  const parsed = readAnnouncementForm(formData);
  if ("error" in parsed) redirect("/admin/announcements?error=required");
  const values = parsed;
  const { error } = await supabase.from("customer_announcements").update({
    ...values,
    updated_at: new Date().toISOString(),
  }).eq("id", id);
  if (error) redirect("/admin/announcements?error=save");
  revalidateAnnouncements();
  redirect("/admin/announcements?success=saved");
}

export async function setCustomerAnnouncementStatus(formData: FormData) {
  const { supabase } = await requireAdmin();
  const id = String(formData.get("id") ?? "");
  const next = String(formData.get("status") ?? "");
  if (!uuid.test(id) || !["draft", "published", "archived"].includes(next)) {
    redirect("/admin/announcements?error=save");
  }
  const patch: Record<string, unknown> = { status: next, updated_at: new Date().toISOString() };
  if (next === "published") {
    patch.published_at = new Date().toISOString();
    patch.archived_at = null;
  }
  if (next === "archived") patch.archived_at = new Date().toISOString();
  if (next === "draft") {
    patch.archived_at = null;
  }
  const { error } = await supabase.from("customer_announcements").update(patch).eq("id", id);
  if (error) redirect("/admin/announcements?error=save");
  revalidateAnnouncements();
  redirect("/admin/announcements?success=saved");
}
