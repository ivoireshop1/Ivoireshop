import { NextResponse, type NextRequest } from "next/server";
import { CANONICAL_PRODUCTION_ORIGIN, isTrustedPublicSiteOrigin, resolvePublicSiteUrl } from "@/src/lib/site";
import { resolvePostLoginPath } from "@/src/lib/auth/post-login";
import {
  isPasswordRecoveryPath,
  isRecoveryFlow,
  RECOVERY_CALLBACK_PATH,
  RECOVERY_INVALID_PATH,
  RECOVERY_REQUEST_PATH,
  RECOVERY_SET_PASSWORD_PATH,
} from "@/src/lib/auth/recovery";
import { sanitizeReturnPath } from "@/src/lib/navigation/smart-navigation";
import { createRouteHandlerClient } from "@/src/lib/supabase/route-handler";

function sitePath(request: NextRequest, path: string) {
  const origin = resolvePublicSiteUrl(process.env as NodeJS.ProcessEnv, request.nextUrl.origin);
  return new URL(path, `${origin.replace(/\/$/, "")}/`);
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type");
  const next = sanitizeReturnPath(searchParams.get("next"), "/account");
  const authError = searchParams.get("error");
  const recoveredHint = isRecoveryFlow(searchParams) || isPasswordRecoveryPath(next);

  // Prefer the dedicated recovery handler whenever recovery intent is present.
  if (recoveredHint && (code || tokenHash || type === "recovery")) {
    const dedicated = new URL(RECOVERY_CALLBACK_PATH, request.nextUrl.origin);
    dedicated.search = request.nextUrl.search;
    if (process.env.VERCEL_ENV === "production") {
      return NextResponse.redirect(new URL(`${RECOVERY_CALLBACK_PATH}${request.nextUrl.search}`, CANONICAL_PRODUCTION_ORIGIN));
    }
    return NextResponse.redirect(dedicated);
  }

  if (authError) {
    if (recoveredHint) {
      return NextResponse.redirect(sitePath(request, RECOVERY_INVALID_PATH));
    }
    return NextResponse.redirect(sitePath(request, "/auth/verify-failed"));
  }

  const requestOrigin = `${request.nextUrl.protocol}//${request.nextUrl.host}`;
  if ((code || tokenHash) && process.env.VERCEL_ENV === "production" && !isTrustedPublicSiteOrigin(requestOrigin)) {
    const canonical = new URL("/auth/callback", CANONICAL_PRODUCTION_ORIGIN);
    canonical.search = request.nextUrl.search;
    return NextResponse.redirect(canonical);
  }

  const { supabase, redirect } = createRouteHandlerClient(request);
  let recovered = isRecoveryFlow(searchParams) || isPasswordRecoveryPath(next);

  if (tokenHash && type) {
    const { error } = await supabase.auth.verifyOtp({
      type: type as "recovery" | "email" | "signup" | "invite" | "magiclink" | "email_change",
      token_hash: tokenHash,
    });
    if (error) {
      return redirect(
        sitePath(
          request,
          type === "recovery" || recovered ? RECOVERY_INVALID_PATH : "/auth/verify-failed",
        ),
      );
    }
    recovered = recovered || type === "recovery";
  } else if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) {
      const {
        data: { user: existing },
      } = await supabase.auth.getUser();
      if (existing && !recovered) {
        const { data: profile } = await supabase.from("profiles").select("role").eq("id", existing.id).maybeSingle();
        return redirect(sitePath(request, resolvePostLoginPath(profile?.role, next)));
      }
      if (recovered) {
        return redirect(sitePath(request, RECOVERY_INVALID_PATH));
      }
      // Failed / consumed auth codes must not dump users into a silent login
      // success state — especially when the code was meant for password recovery.
      return redirect(sitePath(request, "/auth/verify-failed"));
    }
  } else if (recovered) {
    // Fragment tokens never reach this route handler. Do not force stage=set —
    // that path times out to "invalid" when the hash was dropped.
    return NextResponse.redirect(sitePath(request, RECOVERY_REQUEST_PATH));
  } else {
    return NextResponse.redirect(sitePath(request, `/auth/complete?next=${encodeURIComponent(next)}`));
  }

  if (recovered || isPasswordRecoveryPath(next)) {
    return redirect(sitePath(request, RECOVERY_SET_PASSWORD_PATH));
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { data: profile } = user
    ? await supabase.from("profiles").select("role").eq("id", user.id).maybeSingle()
    : { data: null };

  return redirect(sitePath(request, resolvePostLoginPath(profile?.role, next)));
}
