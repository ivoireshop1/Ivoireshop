// Safety guard for destructive auth QA.
// Every password change, global sign-out, or delete performed by a QA script must
// pass through assertTemporaryQaUser first, so a real owner/admin account can
// never be selected by a broad email search or a stale identifier.

export const QA_EMAIL_PATTERN = /^qa-[a-z0-9-]+@example\.(com|invalid|test)$/i;

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isQaEmail(email) {
  return QA_EMAIL_PATTERN.test(String(email ?? ""));
}

// Throws unless the target is a temporary QA user this run created itself.
// `createdIds` is the set of immutable auth IDs the script captured at creation.
export function assertTemporaryQaUser(target, createdIds) {
  const id = String(target?.id ?? "");
  const email = String(target?.email ?? "");
  const role = String(target?.role ?? "");

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
  if (/\blike\b/i.test(text) && /auth\.users/i.test(text)) {
    throw new Error("QA guard: destructive auth statements must not select users by email pattern.");
  }
  if (/\bdelete\s+from\s+auth\.users\b/i.test(text) && !/where\s+id\s*=\s*\$/i.test(text)) {
    throw new Error("QA guard: delete from auth.users requires a parameterized id predicate.");
  }
  return text;
}
