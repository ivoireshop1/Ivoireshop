"use client";

import { useEffect } from "react";
import { createClient } from "@/src/lib/supabase/browser";
import { CANONICAL_PRODUCTION_ORIGIN, isProtectedInfrastructureOrigin, isTrustedPublicSiteOrigin } from "@/src/lib/site";
import { resolvePostLoginPath } from "@/src/lib/auth/post-login";
import { isPasswordRecoveryPath, RECOVERY_CALLBACK_PATH } from "@/src/lib/auth/recovery";

function hashParams() {
  if (typeof window === "undefined") return new URLSearchParams();
  return new URLSearchParams(window.location.hash.replace(/^#/, ""));
}

export function AuthHashCatcher() {
  useEffect(() => {
    const search = new URLSearchParams(window.location.search);
    const pathname = window.location.pathname;
    const onCallback = pathname === "/auth/callback" || pathname === RECOVERY_CALLBACK_PATH;

    if ((search.get("code") || search.get("token_hash")) && !onCallback) {
      const params = new URLSearchParams(window.location.search);
      // Codes that land on the reset pages (or already carry recovery next)
      // must use the dedicated recovery callback — never a generic login handoff.
      if (isPasswordRecoveryPath(pathname) || params.get("next") === "/reset-password" || params.get("type") === "recovery") {
        window.location.replace(`${RECOVERY_CALLBACK_PATH}?${params.toString()}`);
        return;
      }
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
      if (pathname === "/reset-password") return;
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
    // Preview deployments share staging Supabase — keep hash tokens on this host.
    // Only bounce stray Production aliases to the founder storefront.
    const onPreviewHost = /\.vercel\.app$/i.test(new URL(origin).host) && !isTrustedPublicSiteOrigin(origin);
    if (
      isProtectedInfrastructureOrigin(origin) &&
      !isTrustedPublicSiteOrigin(origin) &&
      !onPreviewHost
    ) {
      window.location.replace(`${CANONICAL_PRODUCTION_ORIGIN}/auth/complete${window.location.search}${window.location.hash}`);
      return;
    }
    void (async () => {
      try {
        const supabase = createClient();
        const { error } = await supabase.auth.setSession({ access_token: accessToken, refresh_token: refreshToken });
        if (error) {
          window.location.replace(type === "recovery" ? "/reset-password?error=invalid" : "/auth/verify-failed");
          return;
        }
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (type === "recovery") {
          window.location.replace("/reset-password?stage=set");
          return;
        }
        const { data: profile } = user
          ? await supabase.from("profiles").select("role").eq("id", user.id).maybeSingle()
          : { data: null };
        const next = new URLSearchParams(window.location.search).get("next");
        window.location.replace(resolvePostLoginPath(profile?.role, next));
      } catch {
        window.location.replace(type === "recovery" ? "/reset-password?error=invalid" : "/auth/verify-failed");
      }
    })();
  }, []);
  return null;
}
