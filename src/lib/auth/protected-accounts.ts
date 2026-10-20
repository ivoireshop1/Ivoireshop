/**
 * Production identities that automated tools and QA scripts must never mutate.
 * Keep in sync with scripts/qa-auth-guard.mjs.
 *
 * Do not use these accounts for automated password resets, session revocation,
 * or credential changes. Founder-supervised login only when verification needs Admin.
 */

export const PROTECTED_AUTH_EMAILS = [
  "ivoireshop37@gmail.com",
  "jittabadger.business@gmail.com",
] as const;

/** Known Production admin auth.users id(s). */
export const PROTECTED_AUTH_USER_IDS = [
  "af99b9a1-ccd4-4c1c-b63c-836691e3002d",
] as const;

export function isProtectedAuthEmail(email: string | null | undefined) {
  const normalized = String(email ?? "")
    .trim()
    .toLowerCase();
  return (PROTECTED_AUTH_EMAILS as readonly string[]).includes(normalized);
}

export function isProtectedAuthUserId(id: string | null | undefined) {
  const value = String(id ?? "")
    .trim()
    .toLowerCase();
  return (PROTECTED_AUTH_USER_IDS as readonly string[]).includes(value);
}

export function assertNotProtectedProductionIdentity(target: {
  email?: string | null;
  id?: string | null;
  role?: string | null;
}) {
  if (String(target.role ?? "").toLowerCase() === "admin") {
    throw new Error("Protected identity: refusing to act on a Production admin role.");
  }
  if (isProtectedAuthEmail(target.email)) {
    throw new Error("Protected identity: refusing to act on a Production admin mailbox.");
  }
  if (isProtectedAuthUserId(target.id)) {
    throw new Error("Protected identity: refusing to act on a Production admin user id.");
  }
}
