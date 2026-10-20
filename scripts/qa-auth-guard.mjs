// Safety guard for destructive auth QA.
// Every password change, global sign-out, or delete performed by a QA script must
// pass through assertTemporaryQaUser first, so a real owner/admin account can
// never be selected by a broad email search or a stale identifier.
//
// CRITICAL: Never target Ivoire Shop Production admin identities.
// Keep PROTECTED_* lists aligned with src/lib/auth/protected-accounts.ts.

export const QA_EMAIL_PATTERN = /^qa-[a-z0-9-]+@example\.(com|invalid|test)$/i;

/** Production admin / founder mailboxes that scripts must never modify. */
export const PROTECTED_AUTH_EMAILS = Object.freeze([
  "ivoireshop37@gmail.com",
  "jittabadger.business@gmail.com",
]);

/** Production admin auth.users ids that scripts must never modify. */
export const PROTECTED_AUTH_USER_IDS = Object.freeze([
  "af99b9a1-ccd4-4c1c-b63c-836691e3002d",
]);

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isQaEmail(email) {
  return QA_EMAIL_PATTERN.test(String(email ?? ""));
}

export function isProtectedAuthEmail(email) {
  const normalized = String(email ?? "").trim().toLowerCase();
  return PROTECTED_AUTH_EMAILS.includes(normalized);
}

export function isProtectedAuthUserId(id) {
  const value = String(id ?? "").trim().toLowerCase();
  return PROTECTED_AUTH_USER_IDS.includes(value);
}

export function assertNotProtectedAuthEmail(email) {
  if (isProtectedAuthEmail(email)) {
    throw new Error("QA guard: refusing to act on a protected Production admin mailbox.");
  }
  return String(email ?? "").trim().toLowerCase();
}

export function assertNotProtectedAuthUserId(id) {
  if (isProtectedAuthUserId(id)) {
    throw new Error("QA guard: refusing to act on a protected Production admin user id.");
  }
  return String(id ?? "").trim().toLowerCase();
}

export function assertNotPasswordMutationSql(sql) {
  const text = String(sql ?? "");
  if (/encrypted_password|raw_app_meta_data|auth\.identities/i.test(text) && /\b(update|insert|delete)\b/i.test(text)) {
    throw new Error("QA guard: refusing SQL that mutates auth password or identity material.");
  }
  if (/updateUserById|auth\.admin\.updateUser|generateLink/i.test(text)) {
    throw new Error("QA guard: refusing Admin Auth mutation calls in scripts.");
  }
  return text;
}

// Throws unless the target is a temporary QA user this run created itself.
// `createdIds` is the set of immutable auth IDs the script captured at creation.
export function assertTemporaryQaUser(target, createdIds) {
  const id = String(target?.id ?? "");
  const email = String(target?.email ?? "");
  const role = String(target?.role ?? "");

  assertNotProtectedAuthEmail(email);
  assertNotProtectedAuthUserId(id);

  if (!UUID_PATTERN.test(id)) {
    throw new Error("QA guard: refusing to act without an immutable auth user id.");
  }
  if (role === "admin") {
    throw new Error("QA guard: refusing to act on an account whose profile role is admin.");
  }
  if (!isQaEmail(email)) {
    throw new Error("QA guard: refusing to act on an account outside the QA email pattern.");
  }
  const allowed = createdIds instanceof Set ? createdIds : new Set(createdIds ?? []);
  if (!allowed.has(id)) {
    throw new Error("QA guard: refusing to act on an id this run did not create.");
  }
  return id;
}

// Guards the WHERE clause itself: destructive QA statements must be keyed on a
// captured id, never on a LIKE search across auth.users.
export function assertIdScopedStatement(sql) {
  const text = String(sql ?? "");
  assertNotPasswordMutationSql(text);
  for (const protectedId of PROTECTED_AUTH_USER_IDS) {
    if (text.toLowerCase().includes(protectedId)) {
      throw new Error("QA guard: refusing SQL that references a protected Production admin id.");
    }
  }
  if (/\blike\b/i.test(text) && /auth\.users/i.test(text)) {
    throw new Error("QA guard: destructive auth statements must not select users by email pattern.");
  }
  if (/\bdelete\s+from\s+auth\.users\b/i.test(text) && !/where\s+id\s*=\s*\$/i.test(text)) {
    throw new Error("QA guard: delete from auth.users requires a parameterized id predicate.");
  }
  if (/\bupdate\s+auth\.users\b/i.test(text)) {
    throw new Error("QA guard: refusing UPDATE against auth.users.");
  }
  return text;
}
