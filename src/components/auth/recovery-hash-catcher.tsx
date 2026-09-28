"use client";

import { useEffect } from "react";

export function RecoveryHashCatcher() {
  useEffect(() => {
    const hash = window.location.hash;
    if (!hash) return;
    const params = new URLSearchParams(hash.replace(/^#/, ""));
    const type = params.get("type");
    const hashError = params.get("error") || params.get("error_code");
    if (hashError && (type === "recovery" || params.get("error_code") === "otp_expired")) {
      window.location.replace("/reset-password?error=invalid");
      return;
    }
    if (type !== "recovery") return;
    if (window.location.pathname === "/reset-password") return;
    window.location.replace(`/reset-password${hash}`);
  }, []);
  return null;
}
