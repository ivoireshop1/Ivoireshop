"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/src/lib/auth/guards";
import { sanitizeAnnouncementPath } from "@/src/lib/admin/announcement-helpers";
import { recordAdminIncident } from "@/src/lib/ops/incident";

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function revalidateAnnouncements() {
  revalidatePath("/admin");
  revalidatePath("/admin/announcements");
  revalidatePath("/account");
  revalidatePath("/account/notifications");
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
  const intent = String(formData.get("intent") ?? "draft");
  const { data: { user } } = await supabase.auth.getUser();
  const starts = parsed.starts_at ? new Date(parsed.starts_at) : null;
  const scheduled = Boolean(starts && starts.getTime() > Date.now());
  if (intent === "schedule" && !scheduled) {
    redirect("/admin/announcements?error=schedule");
  }
  const asDraft = intent === "draft";
  const status = asDraft ? "draft" : scheduled ? "scheduled" : "published";
  const { error } = await supabase.from("customer_announcements").insert({
    ...parsed,
    audience: "all_customers",
    status,
    published_at: asDraft ? null : new Date().toISOString(),
    created_by: user?.id ?? null,
  });
  if (error) {
    recordAdminIncident({ route: "/admin/announcements", feature: "announcement_create", category: "database", safeCode: "ANNOUNCEMENT_SAVE" });
    redirect("/admin/announcements?error=save");
  }
  revalidateAnnouncements();
  redirect("/admin/announcements?success=saved");
}

export async function updateCustomerAnnouncement(formData: FormData) {
  const { supabase } = await requireAdmin();
  const id = String(formData.get("id") ?? "");
  if (!uuid.test(id)) redirect("/admin/announcements?error=save");
  const parsed = readAnnouncementForm(formData);
  if ("error" in parsed) redirect("/admin/announcements?error=required");
  const { data, error } = await supabase
    .from("customer_announcements")
    .update({
      ...parsed,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .select("id")
    .maybeSingle();
  if (error || !data) {
    recordAdminIncident({ route: "/admin/announcements", feature: "announcement_update", category: "database", safeCode: "ANNOUNCEMENT_SAVE" });
    redirect("/admin/announcements?error=save");
  }
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
  const { data, error } = await supabase.from("customer_announcements").update(patch).eq("id", id).select("id").maybeSingle();
  if (error || !data) {
    recordAdminIncident({ route: "/admin/announcements", feature: "announcement_status", category: "database", safeCode: "ANNOUNCEMENT_SAVE" });
    redirect("/admin/announcements?error=save");
  }
  revalidateAnnouncements();
  redirect("/admin/announcements?success=saved");
}
