import { sanitizeReturnPath } from "@/src/lib/navigation/smart-navigation";

const BLOCKED = /^(javascript|data|vbscript):/i;

export function isSafeStorefrontPath(value: string | null | undefined) {
  if (!value) return false;
  const trimmed = value.trim();
  if (!trimmed || BLOCKED.test(trimmed)) return false;
  const sanitized = sanitizeReturnPath(trimmed, "");
  return Boolean(sanitized) && sanitized.startsWith("/") && !sanitized.startsWith("//");
}

export function safeStorefrontPath(value: string | null | undefined, fallback = "/shop") {
  return isSafeStorefrontPath(value) ? value!.trim() : fallback;
}
