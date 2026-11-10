"use server";

import { createServerClient } from "@supabase/ssr";
import { cookies, headers } from "next/headers";
import { isAuthRateLimited } from "@/src/lib/auth/resend-cooldown";
import { RECOVERY_CALLBACK_PATH } from "@/src/lib/auth/recovery";
import { resolvePublicSiteUrl } from "@/src/lib/site";
import { getSupabaseConfig } from "@/src/lib/supabase/config";

export async function requestPasswordReset(email: string) {
  const trimmed = email.trim();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
    return { ok: true as const, rateLimited: false };
  }

  const headerStore = await headers();
  const proto = headerStore.get("x-forwarded-proto") ?? "https";
  const host = headerStore.get("x-forwarded-host") ?? headerStore.get("host") ?? "";
  const origin = host ? `${proto}://${host}` : "";
  const redirectTo = `${resolvePublicSiteUrl(process.env, origin)}${RECOVERY_CALLBACK_PATH}`;
  const cookieStore = await cookies();
  const { url, anonKey } = getSupabaseConfig();
  const supabase = createServerClient(url, anonKey, {
    cookieOptions: {
      path: "/",
      sameSite: "lax",
      secure: proto === "https",
    },
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
      },
    },
  });

  const { error } = await supabase.auth.resetPasswordForEmail(trimmed, { redirectTo });
  if (error) {
    return { ok: false as const, rateLimited: isAuthRateLimited(error.message) };
  }
  return { ok: true as const, rateLimited: false };
}
