"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/src/lib/auth/guards";

function textValue(formData: FormData, name: string) {
  return String(formData.get(name) ?? "").trim();
}

export async function setProductReviewStatus(formData: FormData) {
  const { supabase } = await requireAdmin();
  const id = textValue(formData, "id");
  const status = textValue(formData, "status");
  if (!id || !["published", "hidden"].includes(status)) redirect("/admin/reviews?error=review_update_failed");
  const { error } = await supabase.from("product_reviews").update({ status }).eq("id", id);
  if (error) redirect("/admin/reviews?error=review_update_failed");
  revalidatePath("/", "layout");
  redirect("/admin/reviews?success=review_updated");
}

export async function deleteProductReviewAsAdmin(formData: FormData) {
  const { supabase } = await requireAdmin();
  const id = textValue(formData, "id");
  if (!id) redirect("/admin/reviews?error=review_delete_failed");
  const { error } = await supabase.from("product_reviews").delete().eq("id", id);
  if (error) redirect("/admin/reviews?error=review_delete_failed");
  revalidatePath("/", "layout");
  redirect("/admin/reviews?success=review_deleted");
}