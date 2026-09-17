export function firstNameFrom(
  fullName?: string | null,
  fallback?: string | null,
) {
  const named = fullName?.trim();
  if (named) return named.split(/\s+/)[0];
  const emailName = fallback?.split("@")[0]?.trim();
  return emailName || "there";
}
