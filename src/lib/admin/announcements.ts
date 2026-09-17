"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/src/lib/auth/guards";
import { createClient } from "@/src/lib/supabase/server";

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

  const { error } = await supabase.from("storefront_announcements").insert({
    title,
    description,
    badge,
    cta_label: ctaLabel,
    cta_destination: ctaDestination || null,
    product_id: productId || null,
    image_url: imageUrl || null,
    is_published: isPublished,
    priority: Number.isFinite(priority) ? priority : 0,
    starts_at: startsAt ? new Date(startsAt).toISOString() : null,
    ends_at: endsAt ? new Date(endsAt).toISOString() : null,
  });

  if (error) {
    redirect("/admin/content?error=announcement_failed");
  }

  revalidatePath("/admin/content");
  revalidatePath("/");
  revalidatePath("/shop");
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
