import { validatePasswordChange } from "@/src/lib/auth/password-rules";

export type PasswordUpdateClient = {
  auth: {
    getUser: () => Promise<{ data: { user: { id: string } | null } }>;
    updateUser: (payload: { password: string }) => Promise<{ error: { message?: string } | null }>;
    signOut: (options?: { scope?: "global" | "local" | "others" }) => Promise<{ error: { message?: string } | null }>;
  };
};

export function canSetRecoveryPassword(input: {
  stage?: string;
  event?: string | null;
  hasSession: boolean;
  fromRecoveryLink?: boolean;
}) {
  if (!input.hasSession) return false;
  if (input.event === "PASSWORD_RECOVERY") return true;
  if (input.fromRecoveryLink) return true;
  return input.stage === "set";
}

export type RecoveryFragment = { accessToken: string; refreshToken: string };

// Reads the tokens Supabase appends as a URL fragment on a recovery redirect.
// Returns null for anything that is not a usable recovery grant.
export function parseRecoveryFragment(hash: string | null | undefined): RecoveryFragment | null {
  if (!hash) return null;
  const params = new URLSearchParams(String(hash).replace(/^#/, ""));
  if (params.get("error") || params.get("error_code")) return null;
  const type = params.get("type");
  if (type && type !== "recovery") return null;
  const accessToken = params.get("access_token");
  const refreshToken = params.get("refresh_token");
  if (!accessToken || !refreshToken) return null;
  return { accessToken, refreshToken };
}

export async function applyNewPasswordAndRevokeSession(
  supabase: PasswordUpdateClient,
  input: { nextPassword: string; confirmPassword: string },
) {
  const validated = validatePasswordChange(input);
  if (!validated.ok) return { success: false as const, error: validated.error, signedOut: false };

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { success: false as const, error: "This reset link is no longer valid. Request a new one.", signedOut: false };
  }

  const { error } = await supabase.auth.updateUser({ password: validated.password });
  if (error) {
    return { success: false as const, error: "The password could not be updated. Try again.", signedOut: false };
  }

  const signOutResult = await supabase.auth.signOut({ scope: "global" });
  return {
    success: true as const,
    signedOut: !signOutResult.error,
  };
}
