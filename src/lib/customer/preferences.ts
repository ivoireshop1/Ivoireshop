"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/src/lib/supabase/server";
import { requireAdmin } from "@/src/lib/auth/guards";

export async function markWelcomeComplete() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;
  await supabase
    .from("profiles")
    .update({ welcome_completed_at: new Date().toISOString() })
    .eq("id", user.id)
    .is("welcome_completed_at", null);
  revalidatePath("/account");
}

export async function setNotificationSounds(formData: FormData) {
  const enabled = String(formData.get("enabled") ?? "") === "on";
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;
  await supabase.from("profiles").update({ notification_sounds: enabled }).eq("id", user.id);
  revalidatePath("/account");
  revalidatePath("/account/notifications");
}

export async function setAdminNotificationSounds(formData: FormData) {
  const enabled = String(formData.get("enabled") ?? "") === "on";
  const { supabase, user } = await requireAdmin();
  await supabase.from("profiles").update({ admin_notification_sounds: enabled }).eq("id", user.id);
  revalidatePath("/admin/account");
}
