import { NextResponse } from "next/server";
import { createClient } from "@/src/lib/supabase/server";
import { siteConfig } from "@/src/lib/site";
import { sanitizeReturnPath } from "@/src/lib/navigation/smart-navigation";

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

  return NextResponse.redirect(new URL(sanitizeReturnPath(next, "/account"), siteConfig.url));
}
