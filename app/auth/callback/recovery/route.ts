import { NextResponse, type NextRequest } from "next/server";
import { CANONICAL_PRODUCTION_ORIGIN, isTrustedPublicSiteOrigin, resolvePublicSiteUrl } from "@/src/lib/site";
import { RECOVERY_INVALID_PATH, RECOVERY_REQUEST_PATH, RECOVERY_SET_PASSWORD_PATH } from "@/src/lib/auth/recovery";
import { createRouteHandlerClient } from "@/src/lib/supabase/route-handler";

function sitePath(request: NextRequest, path: string) {
  const origin = resolvePublicSiteUrl(process.env as NodeJS.ProcessEnv, request.nextUrl.origin);
  return new URL(path, `${origin.replace(/\/$/, "")}/`);
}

/**
 * Dedicated password-recovery callback.
 * Always finishes on the set-password page (or the invalid/request page) —
 * never on /login, /account, or /admin before a new password is chosen.
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type");
  const authError = searchParams.get("error") || searchParams.get("error_code");

  if (authError) {
    return NextResponse.redirect(sitePath(request, RECOVERY_INVALID_PATH));
  }

  const requestOrigin = `${request.nextUrl.protocol}//${request.nextUrl.host}`;
  if ((code || tokenHash) && process.env.VERCEL_ENV === "production" && !isTrustedPublicSiteOrigin(requestOrigin)) {
    const canonical = new URL("/auth/callback/recovery", CANONICAL_PRODUCTION_ORIGIN);
    canonical.search = request.nextUrl.search;
    return NextResponse.redirect(canonical);
  }

  const { supabase, redirect } = createRouteHandlerClient(request);

  if (tokenHash && (type === "recovery" || !type)) {
    const { error } = await supabase.auth.verifyOtp({
      type: "recovery",
      token_hash: tokenHash,
    });
    if (error) {
      return redirect(sitePath(request, RECOVERY_INVALID_PATH));
    }
    return redirect(sitePath(request, RECOVERY_SET_PASSWORD_PATH));
  }

  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) {
      return redirect(sitePath(request, RECOVERY_INVALID_PATH));
    }
    return redirect(sitePath(request, RECOVERY_SET_PASSWORD_PATH));
  }

  // Implicit/hash tokens never reach the server. Send the browser to the reset
  // page (not stage=set) so a preserved fragment can be consumed, or the user
  // can request a fresh link if the fragment was dropped.
  return NextResponse.redirect(sitePath(request, RECOVERY_REQUEST_PATH));
}
