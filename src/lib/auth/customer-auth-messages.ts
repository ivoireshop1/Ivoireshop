export const AUTH_ERROR_CODES = [
  "expired",
  "already_confirmed",
  "invalid",
  "missing_code",
  "auth_callback",
  "unauthorized",
] as const;

export type AuthErrorCode = (typeof AUTH_ERROR_CODES)[number];

export function isAuthErrorCode(value: string | null | undefined): value is AuthErrorCode {
  return Boolean(value && (AUTH_ERROR_CODES as readonly string[]).includes(value));
}

export function mapAuthProviderFailure(error: { message?: string; code?: string } | null | undefined): AuthErrorCode {
  const text = `${error?.code ?? ""} ${error?.message ?? ""}`.toLowerCase();
  if (text.includes("otp_expired") || text.includes("expired")) return "expired";
  if (text.includes("already") && (text.includes("confirm") || text.includes("verified"))) return "already_confirmed";
  if (text.includes("invalid") || text.includes("token")) return "invalid";
  return "auth_callback";
}

export function mapAuthCallbackQueryError(error: string | null, errorCode: string | null): AuthErrorCode {
  const text = `${error ?? ""} ${errorCode ?? ""}`.toLowerCase();
  if (text.includes("otp_expired") || text.includes("expired")) return "expired";
  if (text.includes("already") && (text.includes("confirm") || text.includes("verified"))) return "already_confirmed";
  return "invalid";
}

export function publicAuthActionMessage(raw: string | null | undefined) {
  const text = (raw ?? "").toLowerCase();
  if (!text) return "Something went wrong. Please try again.";
  if (text.includes("invalid login")) return "That email or password did not match. Please try again.";
  if (text.includes("email not confirmed")) {
    return "Please confirm your email before signing in. You can request another confirmation email below.";
  }
  if (text.includes("already registered") || text.includes("already been registered") || text.includes("user already exists")) {
    return "An account with this email already exists. Sign in, or reset your password if you forgot it.";
  }
  if (text.includes("rate limit") || text.includes("too many")) {
    return "Too many attempts. Please wait a moment and try again.";
  }
  return "We could not complete that request. Please try again.";
}

export function customerAuthPageCopy(code: string | null | undefined) {
  switch (code) {
    case "expired":
      return {
        body: "This confirmation link has expired. Enter your email below to request a new confirmation.",
        resend: true,
      };
    case "already_confirmed":
      return {
        body: "This email is already confirmed. Sign in to continue to your account.",
        resend: false,
      };
    case "invalid":
      return {
        body: "This confirmation link is not valid. Request a new confirmation or sign in if your account is already active.",
        resend: true,
      };
    case "missing_code":
      return {
        body: "That confirmation link was incomplete. Open the latest email from Ivoire Shop, or request a new confirmation.",
        resend: true,
      };
    case "auth_callback":
      return {
        body: "We could not finish confirming your account. Request a new confirmation email or try signing in.",
        resend: true,
      };
    default:
      return null;
  }
}
