"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/src/lib/supabase/server";
import { requireAdmin } from "@/src/lib/auth/guards";
import { clampNotificationVolume, DEFAULT_NOTIFICATION_VOLUME_PERCENT } from "@/src/lib/audio/volume";

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
  return setNotificationSoundPreferences(null, formData);
}

export async function setNotificationSoundPreferences(
  _prev: { saved?: boolean; error?: string; enabled?: boolean; volume?: number } | null,
  formData: FormData,
) {
  const enabled = String(formData.get("enabled") ?? "") === "on";
  const volume = clampNotificationVolume(formData.get("volume") ?? DEFAULT_NOTIFICATION_VOLUME_PERCENT);
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Sign in to save notification sounds." };
  const { error } = await supabase
    .from("profiles")
    .update({ notification_sounds: enabled, notification_volume: volume })
    .eq("id", user.id);
  if (error) return { error: "Notification sounds could not be saved." };
  revalidatePath("/account");
  revalidatePath("/account/notifications");
  return { saved: true, enabled, volume };
}

export async function setAdminNotificationSounds(formData: FormData) {
  return setAdminNotificationSoundPreferences(null, formData);
}

export async function setAdminNotificationSoundPreferences(
  _prev: { saved?: boolean; error?: string; enabled?: boolean; volume?: number } | null,
  formData: FormData,
) {
  const enabled = String(formData.get("enabled") ?? "") === "on";
  const volume = clampNotificationVolume(formData.get("volume") ?? DEFAULT_NOTIFICATION_VOLUME_PERCENT);
  const { supabase, user } = await requireAdmin();
  const { error } = await supabase
    .from("profiles")
    .update({ admin_notification_sounds: enabled, admin_notification_volume: volume })
    .eq("id", user.id);
  if (error) return { error: "Notification sounds could not be saved." };
  revalidatePath("/admin/account");
  revalidatePath("/admin/notifications");
  return { saved: true, enabled, volume };
}
