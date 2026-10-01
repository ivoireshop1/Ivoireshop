"use client";

import { useEffect } from "react";
import { createClient } from "@/src/lib/supabase/browser";
import { CANONICAL_PRODUCTION_ORIGIN, isProtectedInfrastructureOrigin, isTrustedPublicSiteOrigin } from "@/src/lib/site";
import { resolvePostLoginPath } from "@/src/lib/auth/post-login";

function hashParams() {
  if (typeof window === "undefined") return new URLSearchParams();
  return new URLSearchParams(window.location.hash.replace(/^#/, ""));
}

export function AuthHashCatcher() {
  useEffect(() => {
    const search = new URLSearchParams(window.location.search);
    if ((search.get("code") || search.get("token_hash")) && window.location.pathname !== "/auth/callback") {
      window.location.replace(`/auth/callback${window.location.search}`);
      return;
    }
    const params = hashParams();
    const type = params.get("type");
    const hashError = params.get("error") || params.get("error_code");
    if (hashError && (type === "recovery" || params.get("error_code") === "otp_expired")) {
      window.location.replace("/reset-password?error=invalid");
      return;
    }
    if (type === "recovery") {
      if (window.location.pathname === "/reset-password") return;
      window.location.replace(`/reset-password${window.location.hash}`);
      return;
    }
    const accessToken = params.get("access_token");
    const refreshToken = params.get("refresh_token");
    if (!accessToken || !refreshToken) {
      if (hashError && (type === "signup" || type === "email" || type === "magiclink")) {
        window.location.replace("/auth/verify-failed");
      }
      return;
    }
    const origin = window.location.origin;
    if (isProtectedInfrastructureOrigin(origin) && !isTrustedPublicSiteOrigin(origin)) {
      window.location.replace(`${CANONICAL_PRODUCTION_ORIGIN}/auth/complete${window.location.search}${window.location.hash}`);
      return;
    }
    void (async () => {
      const supabase = createClient();
      const { error } = await supabase.auth.setSession({ access_token: accessToken, refresh_token: refreshToken });
      if (error) {
        window.location.replace("/auth/verify-failed");
        return;
      }
      const { data: { user } } = await supabase.auth.getUser();
      const { data: profile } = user
        ? await supabase.from("profiles").select("role").eq("id", user.id).maybeSingle()
        : { data: null };
      const next = new URLSearchParams(window.location.search).get("next");
      window.location.replace(resolvePostLoginPath(profile?.role, next));
    })();
  }, []);
  return null;
}
