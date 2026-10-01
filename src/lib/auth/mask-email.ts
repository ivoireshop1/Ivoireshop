export function maskEmail(email: string) {
  const trimmed = email.trim();
  const at = trimmed.indexOf("@");
  if (at < 1 || at === trimmed.length - 1) return "your email";
  const local = trimmed.slice(0, at);
  const domain = trimmed.slice(at + 1);
  const visible = local.slice(0, 1);
  return `${visible}${"*".repeat(Math.max(5, Math.min(8, local.length)))}@${domain}`;
}

export const PENDING_SIGNUP_EMAIL_KEY = "ivoire.pendingSignupEmail";
export const RESEND_CONFIRM_AT_KEY = "ivoire.resendConfirmAt";
export const RESEND_COOLDOWN_MS = 60_000;
