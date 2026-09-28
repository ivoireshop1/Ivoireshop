export function isPasswordRecoveryPath(path: string | null | undefined) {
  if (!path) return false;
  const pathname = path.split("?")[0];
  return pathname === "/reset-password" || pathname === "/update-password";
}

export const RECOVERY_SET_PASSWORD_PATH = "/reset-password?stage=set";
export const RECOVERY_INVALID_PATH = "/reset-password?error=invalid";
export const RECOVERY_REQUEST_PATH = "/reset-password";
