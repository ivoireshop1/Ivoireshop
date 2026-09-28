"use server";

import { createClient } from "@/src/lib/supabase/server";
import { validatePasswordChange } from "@/src/lib/auth/password-rules";

export type PasswordChangeResult = { success: true } | { success: false; error: string };
export type PasswordRecoveryResult =
  | { success: true; signedOut: boolean }
  | { success: false; error: string };

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

export async function completePasswordRecovery(input: {
  nextPassword: string;
  confirmPassword: string;
}): Promise<PasswordRecoveryResult> {
  const validated = validatePasswordChange(input);
  if (!validated.ok) return { success: false, error: validated.error };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { success: false, error: "This reset link is no longer valid. Request a new one." };
  }

  const { error } = await supabase.auth.updateUser({ password: validated.password });
  if (error) {
    return { success: false, error: "The password could not be updated. Try again." };
  }

  const { error: signOutError } = await supabase.auth.signOut({ scope: "global" });
  return { success: true, signedOut: !signOutError };
}

export async function revokeServerSession() {
  const supabase = await createClient();
  const { error } = await supabase.auth.signOut({ scope: "local" });
  return { signedOut: !error };
}
