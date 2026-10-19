/** Browser-local guest order access refs. Tokens only — no email/name/address. */

export const GUEST_ORDER_STORAGE_KEY = "ivoire.guest.orders.v1";
export const GUEST_ACCESS_TOKEN_RE = /^[0-9a-f]{64}$/;
const MAX_REFS = 24;

export type GuestOrderRef = {
  /** High-entropy guest_access_token (64 hex). */
  t: string;
  /** Unix ms when this device saved the ref. */
  a: number;
};

export function isGuestAccessToken(value: unknown): value is string {
  return typeof value === "string" && GUEST_ACCESS_TOKEN_RE.test(value);
}

export function normalizeGuestOrderRefs(raw: unknown): GuestOrderRef[] {
  if (!Array.isArray(raw)) return [];
  const seen = new Set<string>();
  const refs: GuestOrderRef[] = [];
  for (const row of raw) {
    if (!row || typeof row !== "object") continue;
    const token = (row as { t?: unknown }).t;
    const added = Number((row as { a?: unknown }).a);
    if (!isGuestAccessToken(token) || seen.has(token)) continue;
    seen.add(token);
    refs.push({ t: token, a: Number.isFinite(added) && added > 0 ? added : Date.now() });
  }
  return refs.sort((left, right) => right.a - left.a).slice(0, MAX_REFS);
}

export function loadGuestOrderRefs(): GuestOrderRef[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(GUEST_ORDER_STORAGE_KEY);
    if (!raw) return [];
    return normalizeGuestOrderRefs(JSON.parse(raw));
  } catch {
    return [];
  }
}

function writeGuestOrderRefs(refs: GuestOrderRef[]) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(
      GUEST_ORDER_STORAGE_KEY,
      JSON.stringify(normalizeGuestOrderRefs(refs)),
    );
  } catch {
    /* storage is optional (private mode / quota) */
  }
}

/** Persist a guest access token on this browser after paid checkout or recovery. */
export function rememberGuestOrderToken(token: string): GuestOrderRef[] {
  if (!isGuestAccessToken(token)) return loadGuestOrderRefs();
  const existing = loadGuestOrderRefs().filter((ref) => ref.t !== token);
  const next = [{ t: token, a: Date.now() }, ...existing];
  writeGuestOrderRefs(next);
  return normalizeGuestOrderRefs(next);
}

export function forgetGuestOrderToken(token: string): GuestOrderRef[] {
  const next = loadGuestOrderRefs().filter((ref) => ref.t !== token);
  writeGuestOrderRefs(next);
  return next;
}

/** Remove all guest order refs from this device. Does not delete database orders. */
export function clearGuestOrderRefsOnDevice(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(GUEST_ORDER_STORAGE_KEY);
  } catch {
    /* optional */
  }
}

export function guestOrderTokens(): string[] {
  return loadGuestOrderRefs().map((ref) => ref.t);
}
