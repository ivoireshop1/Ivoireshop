"use server";

import { createClient } from "@/src/lib/supabase/server";
import { validatePasswordChange } from "@/src/lib/auth/password-rules";

export type PasswordChangeResult = { success: true } | { success: false; error: string };

export async function changeAuthenticatedPassword(input: {
  nextPassword: string;
  confirmPassword: string;
}): Promise<PasswordChangeResult> {
  const validated = validatePasswordChange(input);
  if (!validated.ok) {
    return { success: false, error: validated.error };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { success: false, error: "Sign in to change your password." };
  }

  const { error } = await supabase.auth.updateUser({ password: validated.password });
  if (error) {
    return { success: false, error: "The password could not be updated. Try again." };
  }
  return { success: true };
}
