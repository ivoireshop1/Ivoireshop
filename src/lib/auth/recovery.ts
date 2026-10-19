export function isPasswordRecoveryPath(path: string | null | undefined) {
  if (!path) return false;
  const pathname = path.split("?")[0];
  return pathname === "/reset-password" || pathname === "/update-password";
}

/** Dedicated PKCE landing path — always completes into the set-password stage. */
export const RECOVERY_CALLBACK_PATH = "/auth/callback/recovery";

export const RECOVERY_SET_PASSWORD_PATH = "/reset-password?stage=set";
export const RECOVERY_INVALID_PATH = "/reset-password?error=invalid";
export const RECOVERY_REQUEST_PATH = "/reset-password";

export function isRecoveryFlow(searchParams: URLSearchParams | { get(name: string): string | null }) {
  const flow = searchParams.get("flow");
  const type = searchParams.get("type");
  const next = searchParams.get("next");
  return flow === "recovery" || type === "recovery" || isPasswordRecoveryPath(next);
}
