import { type NextRequest, NextResponse } from "next/server";
import { CANONICAL_PRODUCTION_ORIGIN, isProtectedInfrastructureOrigin, isTrustedPublicSiteOrigin } from "@/src/lib/site";
import { isPasswordRecoveryPath, RECOVERY_CALLBACK_PATH } from "@/src/lib/auth/recovery";
import { updateSession } from "@/src/lib/supabase/proxy";

export async function proxy(request: NextRequest) {
  const { pathname, searchParams } = request.nextUrl;
  const requestOrigin = `${request.nextUrl.protocol}//${request.nextUrl.host}`;
  if (
    process.env.VERCEL_ENV === "production" &&
    isProtectedInfrastructureOrigin(requestOrigin) &&
    !isTrustedPublicSiteOrigin(requestOrigin)
  ) {
    const canonical = new URL(pathname + request.nextUrl.search, CANONICAL_PRODUCTION_ORIGIN);
    return NextResponse.redirect(canonical, 307);
  }
  // Supabase may deliver PKCE / OTP params on any path. Route them, but never
  // steal password-recovery codes into the generic post-login callback.
  if (
    pathname !== "/auth/callback" &&
    pathname !== RECOVERY_CALLBACK_PATH &&
    (searchParams.has("code") || searchParams.has("token_hash"))
  ) {
    const dest = request.nextUrl.clone();
    const recoveryIntent =
      isPasswordRecoveryPath(pathname) ||
      searchParams.get("type") === "recovery" ||
      searchParams.get("flow") === "recovery" ||
      searchParams.get("next") === "/reset-password";
    dest.pathname = recoveryIntent ? RECOVERY_CALLBACK_PATH : "/auth/callback";
    return NextResponse.redirect(dest);
  }
  return updateSession(request);
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|audio/|sounds/|api/payments/stripe/webhook|.*\\.(?:svg|png|jpg|jpeg|gif|webp|wav|mp3|m4a|ogg)$).*)",
  ],
};
