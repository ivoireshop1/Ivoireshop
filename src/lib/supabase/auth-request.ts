/** Cookie names created by @supabase/ssr. Chunks look like `sb-<ref>-auth-token.0`. */
export function isSupabaseSessionCookieName(name: string) {
  return name.includes("-auth-token") && !name.includes("-code-verifier");
}

export function hasSupabaseSessionCookie(cookies: Array<{ name: string; value?: string }>) {
  return cookies.some((cookie) => isSupabaseSessionCookieName(cookie.name) && Boolean(cookie.value));
}

export function readBrowserSupabaseSessionCookie(cookieHeader = typeof document === "undefined" ? "" : document.cookie) {
  return cookieHeader.split(";").some((part) => {
    const trimmed = part.trim();
    const separator = trimmed.indexOf("=");
    if (separator <= 0) return false;
    const name = trimmed.slice(0, separator);
    const value = trimmed.slice(separator + 1);
    return isSupabaseSessionCookieName(name) && value.length > 0;
  });
}

/** Next.js strips these inside Proxy, so the matcher is the reliable prefetch gate. */
export function requestHasPrefetchHeader(headers: { get(name: string): string | null }) {
  if (headers.get("next-router-prefetch") || headers.get("next-router-segment-prefetch")) return true;
  const purpose = `${headers.get("purpose") ?? ""} ${headers.get("sec-purpose") ?? ""}`.toLowerCase();
  return purpose.includes("prefetch");
}

/**
 * Guests and prefetches do not need a server Auth round trip.
 * A real navigation that already has a session cookie still refreshes it.
 */
export function shouldRefreshSupabaseSession(input: {
  cookies: Array<{ name: string; value?: string }>;
  headers: { get(name: string): string | null };
}) {
  if (requestHasPrefetchHeader(input.headers)) return false;
  return hasSupabaseSessionCookie(input.cookies);
}

export type HeaderRoleSync = "guest" | "profile" | "keep";

/** Profile lookup is not an Auth request. Missing initial sessions keep the server-rendered role. */
export function headerRoleSync(event: string, hasSession: boolean): HeaderRoleSync {
  if (!hasSession) return event === "SIGNED_OUT" ? "guest" : "keep";
  if (event === "INITIAL_SESSION" || event === "SIGNED_IN" || event === "USER_UPDATED") return "profile";
  return "keep";
}

export type VisitKind = "document" | "prefetch";

/** Auth `/user` calls caused by the global shell. Server actions and checkout are separate. */
export function shellAuthRequestCount(input: { kind: VisitKind; signedIn: boolean; optimized: boolean }) {
  if (!input.optimized) {
    return input.kind === "prefetch" ? 1 : 4;
  }
  if (input.kind === "prefetch") return 0;
  return input.signedIn ? 2 : 0;
}
