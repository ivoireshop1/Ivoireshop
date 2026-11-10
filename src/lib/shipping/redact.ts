const SECRET = /\b(?:Bearer\s+\S+|Basic\s+\S+|(?:sand|prod)_[A-Za-z0-9+/=]+|sk_(?:live|test)_[A-Za-z0-9]+|whsec_[A-Za-z0-9]+)\b/gi;
const EMAIL = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi;
const PHONE = /\+?\d[\d().\s-]{7,}\d/g;

export function redactShippingDiagnostics(value: unknown): unknown {
  if (value == null) return value;
  if (typeof value === "string") {
    return value
      .replace(SECRET, "[redacted]")
      .replace(EMAIL, "[redacted-email]")
      .replace(PHONE, "[redacted-phone]")
      .slice(0, 400);
  }
  if (Array.isArray(value)) return value.slice(0, 50).map(redactShippingDiagnostics);
  if (typeof value === "object") {
    const row = value as Record<string, unknown>;
    const next: Record<string, unknown> = {};
    for (const [key, item] of Object.entries(row)) {
      const name = key.toLowerCase();
      if (
        name.includes("address")
        || name.includes("line_1")
        || name.includes("line_2")
        || name === "city"
        || name === "state"
        || name === "postal_code"
        || name === "phone"
        || name === "email"
        || name.includes("key")
        || name.includes("token")
        || name.includes("authorization")
      ) {
        next[key] = "[redacted]";
        continue;
      }
      next[key] = redactShippingDiagnostics(item);
    }
    return next;
  }
  return value;
}
