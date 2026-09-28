"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/src/lib/auth/guards";
import { createClient } from "@/src/lib/supabase/server";
import { isPersistentImageUrl } from "@/src/lib/catalog/image-url";
import { isSafeStorefrontPath, safeStorefrontPath } from "@/src/lib/storefront/cta";

function textValue(formData: FormData, key: string) {
  return String(formData.get(key) ?? "").trim();
}

export async function createAnnouncement(formData: FormData) {
  const { supabase } = await requireAdmin();

  const title = textValue(formData, "title");
  const description = textValue(formData, "description");
  const badge = textValue(formData, "badge") || "Featured";
  const ctaLabel = textValue(formData, "cta_label") || "Learn more";
  const ctaDestination = textValue(formData, "cta_destination") || "";
  const productId = textValue(formData, "product_id") || null;
  const imageUrl = textValue(formData, "image_url") || null;
  const isPublished = formData.get("is_published") === "on";
  const priority = Number(textValue(formData, "priority") || "0");
  const startsAt = textValue(formData, "starts_at") || null;
  const endsAt = textValue(formData, "ends_at") || null;

  if (!title || !description) {
    redirect("/admin/content?error=announcement_required");
  }
  if (ctaDestination && !isSafeStorefrontPath(ctaDestination)) {
    redirect("/admin/content?error=announcement_destination");
  }
  if (imageUrl && !isPersistentImageUrl(imageUrl)) {
    redirect("/admin/content?error=announcement_image");
  }

  const { data: created, error } = await supabase.from("storefront_announcements").insert({
    title,
    description,
    badge,
    cta_label: ctaLabel,
    cta_destination: ctaDestination ? safeStorefrontPath(ctaDestination) : "/shop",
    product_id: productId || null,
    image_url: imageUrl || null,
    is_published: isPublished,
    priority: Number.isFinite(priority) ? priority : 0,
    starts_at: startsAt ? new Date(startsAt).toISOString() : null,
    ends_at: endsAt ? new Date(endsAt).toISOString() : null,
  }).select("id").single();

  if (error || !created) {
    redirect("/admin/content?error=announcement_failed");
  }

  if (isPublished) {
    await supabase.from("storefront_announcements").update({ is_published: false }).neq("id", created.id);
  }

  revalidatePath("/admin/content");
  revalidatePath("/");
  revalidatePath("/shop");
  revalidatePath("/account");
  redirect("/admin/content?success=announcement_created");
}

export async function listAnnouncements() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("storefront_announcements")
    .select("id, title, description, badge, cta_label, cta_destination, product_id, image_url, is_published, starts_at, ends_at, priority, created_at, product:product_id ( id, slug, name )")
    .order("priority", { ascending: false })
    .order("created_at", { ascending: false });

  if (error) {
    return [] as Array<{
      id: string;
      title: string;
      description: string;
      badge: string;
      cta_label: string;
      cta_destination: string | null;
      product_id: string | null;
      image_url: string | null;
      is_published: boolean;
      priority: number;
      product?: { id: string; slug: string; name: string } | null;
    }>;
  }

  return (data ?? []) as unknown as Array<{
    id: string;
    title: string;
    description: string;
    badge: string;
    cta_label: string;
    cta_destination: string | null;
    product_id: string | null;
    image_url: string | null;
    is_published: boolean;
    priority: number;
    product?: { id: string; slug: string; name: string } | null;
  }>;
}

export async function getActiveStorefrontBillboard() {
  const supabase = await createClient();
  const { data } = await supabase
    .from("storefront_announcements")
    .select("id, title, description, badge, cta_label, cta_destination, image_url, is_published, starts_at, ends_at, priority")
    .eq("is_published", true)
    .order("priority", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(5);
  const now = Date.now();
  return (data ?? []).find((row) => {
    if (row.starts_at && new Date(row.starts_at).getTime() > now) return false;
    if (row.ends_at && new Date(row.ends_at).getTime() < now) return false;
    return true;
  }) ?? null;
}

export async function setAnnouncementPublished(formData: FormData) {
  const { supabase } = await requireAdmin();
  const id = textValue(formData, "id");
  const next = formData.get("is_published") === "true";
  if (!id) redirect("/admin/content?error=announcement_failed");
  if (next) {
    await supabase.from("storefront_announcements").update({ is_published: false }).neq("id", id);
  }
  const { error } = await supabase.from("storefront_announcements").update({ is_published: next }).eq("id", id);
  if (error) redirect("/admin/content?error=announcement_failed");
  revalidatePath("/admin/content");
  revalidatePath("/");
  revalidatePath("/shop");
  revalidatePath("/account");
  redirect("/admin/content?success=announcement_updated");
}

export async function deleteAnnouncement(formData: FormData) {
  const { supabase } = await requireAdmin();
  const id = textValue(formData, "id");
  if (!id) redirect("/admin/content?error=announcement_failed");
  const { error } = await supabase.from("storefront_announcements").delete().eq("id", id);
  if (error) redirect("/admin/content?error=announcement_failed");
  revalidatePath("/admin/content");
  revalidatePath("/");
  revalidatePath("/shop");
  revalidatePath("/account");
  redirect("/admin/content?success=announcement_deleted");
}
