import { NextResponse, type NextRequest } from "next/server";
import { siteConfig } from "@/src/lib/site";
import { resolvePostLoginPath } from "@/src/lib/auth/post-login";
import { isPasswordRecoveryPath, RECOVERY_INVALID_PATH, RECOVERY_SET_PASSWORD_PATH } from "@/src/lib/auth/recovery";
import { sanitizeReturnPath } from "@/src/lib/navigation/smart-navigation";
import { createRouteHandlerClient } from "@/src/lib/supabase/route-handler";

function sitePath(path: string) {
  return new URL(path, `${siteConfig.url.replace(/\/$/, "")}/`);
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type");
  const next = sanitizeReturnPath(searchParams.get("next"), "/account");
  const authError = searchParams.get("error");

  if (authError) {
    return NextResponse.redirect(sitePath(RECOVERY_INVALID_PATH));
  }

  const { supabase, redirect } = createRouteHandlerClient(request);
  let recovered = type === "recovery" || isPasswordRecoveryPath(next);

  if (tokenHash && type) {
    const { error } = await supabase.auth.verifyOtp({
      type: type as "recovery" | "email" | "signup" | "invite" | "magiclink" | "email_change",
      token_hash: tokenHash,
    });
    if (error) {
      return redirect(sitePath(type === "recovery" || recovered ? RECOVERY_INVALID_PATH : "/login?error=auth_callback"));
    }
    recovered = recovered || type === "recovery";
  } else if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) {
      return redirect(sitePath(recovered ? RECOVERY_INVALID_PATH : "/login?error=auth_callback"));
    }
  } else if (recovered) {
    // Supabase delivers recovery tokens in the URL fragment when the email link
    // was not issued through PKCE. A route handler cannot read a fragment, so
    // hand the request to the reset page, which the browser reaches with the
    // fragment still attached.
    return NextResponse.redirect(sitePath(RECOVERY_SET_PASSWORD_PATH));
  } else {
    return NextResponse.redirect(sitePath("/login?error=missing_code"));
  }

  if (recovered || isPasswordRecoveryPath(next)) {
    return redirect(sitePath(RECOVERY_SET_PASSWORD_PATH));
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { data: profile } = user
    ? await supabase.from("profiles").select("role").eq("id", user.id).maybeSingle()
    : { data: null };

  return redirect(sitePath(resolvePostLoginPath(profile?.role, next)));
}
