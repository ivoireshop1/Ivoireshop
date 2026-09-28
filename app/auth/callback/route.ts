import { NextResponse } from "next/server";
import { createClient } from "@/src/lib/supabase/server";
import { siteConfig } from "@/src/lib/site";
import { resolvePostLoginPath } from "@/src/lib/auth/post-login";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next");

  if (!code) {
    return NextResponse.redirect(new URL("/login?error=missing_code", siteConfig.url));
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    return NextResponse.redirect(new URL("/login?error=auth_callback", siteConfig.url));
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { data: profile } = user
    ? await supabase.from("profiles").select("role").eq("id", user.id).maybeSingle()
    : { data: null };

  return NextResponse.redirect(new URL(resolvePostLoginPath(profile?.role, next), siteConfig.url));
}
