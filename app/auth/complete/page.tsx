"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { AuthHashCatcher } from "@/src/components/auth/auth-hash-catcher";

export default function AuthCompletePage() {
  const [status, setStatus] = useState("Finishing sign-in…");
  useEffect(() => {
    const search = new URLSearchParams(window.location.search);
    const code = search.get("code");
    const tokenHash = search.get("token_hash");
    if (code || tokenHash) {
      window.location.replace(`/auth/callback${window.location.search}`);
      return;
    }
    const hash = new URLSearchParams(window.location.hash.replace(/^#/, ""));
    if (!hash.get("access_token") && !hash.get("error")) {
      window.setTimeout(() => setStatus("That confirmation link was incomplete."), 0);
    }
  }, []);
  return (
    <main className="mx-auto w-full max-w-lg px-5 py-16">
      <AuthHashCatcher />
      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-gold">Ivoire Shop</p>
      <h1 className="mt-3 text-3xl font-semibold text-forest-green">Confirming your account</h1>
      <p className="mt-4 text-sm leading-6 text-muted">{status}</p>
      {status.includes("incomplete") ? (
        <div className="mt-6 flex flex-wrap gap-3">
          <Link className="min-h-11 rounded-lg bg-forest-green px-4 py-2 text-sm font-semibold text-white" href="/login">
            Return to Sign In
          </Link>
          <Link className="min-h-11 rounded-lg border border-forest-green/20 px-4 py-2 text-sm font-semibold text-forest-green" href="/signup/check-email">
            Request a new confirmation email
          </Link>
        </div>
      ) : null}
    </main>
  );
}
