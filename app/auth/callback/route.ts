import { NextResponse } from "next/server";
import { createClient } from "@/src/lib/supabase/server";
import { siteConfig } from "@/src/lib/site";
import { resolvePostLoginPath } from "@/src/lib/auth/post-login";
import { isPasswordRecoveryPath, RECOVERY_INVALID_PATH, RECOVERY_SET_PASSWORD_PATH } from "@/src/lib/auth/recovery";
import { sanitizeReturnPath } from "@/src/lib/navigation/smart-navigation";

function sitePath(path: string) {
  return new URL(path, `${siteConfig.url.replace(/\/$/, "")}/`);
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type");
  const next = sanitizeReturnPath(searchParams.get("next"), "/account");
  const authError = searchParams.get("error");

  if (authError) {
    return NextResponse.redirect(sitePath(RECOVERY_INVALID_PATH));
  }

  const supabase = await createClient();
  let recovered = type === "recovery" || isPasswordRecoveryPath(next);

  if (tokenHash && type) {
    const { error } = await supabase.auth.verifyOtp({
      type: type as "recovery" | "email" | "signup" | "invite" | "magiclink" | "email_change",
      token_hash: tokenHash,
    });
    if (error) {
      return NextResponse.redirect(sitePath(type === "recovery" || recovered ? RECOVERY_INVALID_PATH : "/login?error=auth_callback"));
    }
    recovered = recovered || type === "recovery";
  } else if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) {
      return NextResponse.redirect(sitePath(recovered ? RECOVERY_INVALID_PATH : "/login?error=auth_callback"));
    }
  } else {
    return NextResponse.redirect(sitePath(recovered ? RECOVERY_INVALID_PATH : "/login?error=missing_code"));
  }

  if (recovered || isPasswordRecoveryPath(next)) {
    return NextResponse.redirect(sitePath(RECOVERY_SET_PASSWORD_PATH));
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { data: profile } = user
    ? await supabase.from("profiles").select("role").eq("id", user.id).maybeSingle()
    : { data: null };

  return NextResponse.redirect(sitePath(resolvePostLoginPath(profile?.role, next)));
}
