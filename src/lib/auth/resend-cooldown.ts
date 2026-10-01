import { RESEND_COOLDOWN_MS } from "./mask-email";

export function remainingResendMs(lastSentAt: number | null | undefined, now = Date.now()) {
  if (!lastSentAt || lastSentAt > now) return 0;
  return Math.max(0, lastSentAt + RESEND_COOLDOWN_MS - now);
}

export function resendCooldownLabel(remainingMs: number) {
  const seconds = Math.ceil(remainingMs / 1000);
  if (seconds <= 0) return "";
  return `Resend available in ${seconds} second${seconds === 1 ? "" : "s"}`;
}

export function isAuthRateLimited(raw: string | null | undefined) {
  const text = (raw ?? "").toLowerCase();
  return text.includes("rate limit") || text.includes("too many") || text.includes("over_email_send_rate_limit");
}
