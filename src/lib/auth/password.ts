"use server";

import { createClient } from "@/src/lib/supabase/server";

export type PasswordChangeResult = { success: true } | { success: false; error: string };

const MIN_LENGTH = 8;

export async function changeAuthenticatedPassword(input: {
  nextPassword: string;
  confirmPassword: string;
}): Promise<PasswordChangeResult> {
  const nextPassword = String(input.nextPassword ?? "");
  const confirmPassword = String(input.confirmPassword ?? "");

  if (nextPassword.length < MIN_LENGTH) {
    return { success: false, error: `Use at least ${MIN_LENGTH} characters.` };
  }
  if (nextPassword !== confirmPassword) {
    return { success: false, error: "The new passwords do not match." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { success: false, error: "Sign in to change your password." };
  }

  const { error } = await supabase.auth.updateUser({ password: nextPassword });
  if (error) {
    return { success: false, error: "The password could not be updated. Try again." };
  }
  return { success: true };
}
