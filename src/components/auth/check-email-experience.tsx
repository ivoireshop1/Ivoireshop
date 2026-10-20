"use client";

import Link from "next/link";
import { useState, useSyncExternalStore } from "react";
import { createClient } from "@/src/lib/supabase/browser";
import { getAuthCallbackUrl } from "@/src/lib/site";
import { maskEmail, PENDING_SIGNUP_EMAIL_KEY, RESEND_CONFIRM_AT_KEY } from "@/src/lib/auth/mask-email";
import { isAuthRateLimited, remainingResendMs, resendCooldownLabel } from "@/src/lib/auth/resend-cooldown";
import { RATE_LIMIT_BODY, RATE_LIMIT_TITLE } from "@/src/lib/auth/customer-auth-messages";

function readEmail() {
  try {
    return sessionStorage.getItem(PENDING_SIGNUP_EMAIL_KEY) ?? "";
  } catch {
    return "";
  }
}

function readRemaining() {
  try {
    const last = Number(sessionStorage.getItem(RESEND_CONFIRM_AT_KEY) ?? 0);
    return remainingResendMs(last || null);
  } catch {
    return 0;
  }
}

function subscribeResend(onStoreChange: () => void) {
  const timer = window.setInterval(onStoreChange, 250);
  return () => window.clearInterval(timer);
}

export function CheckEmailExperience() {
  const email = useSyncExternalStore(() => () => {}, readEmail, () => "");
  const remainingMs = useSyncExternalStore(subscribeResend, readRemaining, () => 0);
  const [status, setStatus] = useState("");
  const [rateLimited, setRateLimited] = useState(false);
  const [busy, setBusy] = useState(false);

  async function resend() {
    if (!email || remainingMs > 0 || busy) return;
    setBusy(true);
    setStatus("");
    setRateLimited(false);
    const supabase = createClient();
    const { error } = await supabase.auth.resend({
      type: "signup",
      email,
      options: { emailRedirectTo: getAuthCallbackUrl("/account") },
    });
    setBusy(false);
    if (error) {
      if (isAuthRateLimited(error.message)) {
        setRateLimited(true);
        return;
      }
      setStatus("We could not send another confirmation just now. Please wait a moment and try again.");
      return;
    }
    try {
      sessionStorage.setItem(RESEND_CONFIRM_AT_KEY, String(Date.now()));
    } catch { /* cooldown is best-effort */ }
    setStatus("A fresh confirmation email is on its way. Check your inbox and spam folder.");
  }

  const cooldown = remainingMs > 0;

  return (
    <main className="mx-auto flex min-h-[70vh] w-full min-w-0 max-w-lg items-center overflow-x-hidden px-4 py-12 sm:px-6 sm:py-16">
      <section className="w-full min-w-0 rounded-2xl bg-surface p-5 shadow-sm sm:p-8">
        <p className="mb-3 text-sm font-medium uppercase tracking-[0.2em] text-gold">Ivoire Shop</p>
        <h1 className="text-2xl font-semibold break-words text-forest-green sm:text-3xl">Confirm your email</h1>
        <p className="mt-4 text-sm leading-6 text-muted">
          We sent a confirmation link{email ? ` to ${maskEmail(email)}` : " to your email"}.
          Open the newest message from Ivoire Shop and tap the link to finish creating your account.
        </p>
        <p className="mt-3 text-sm text-muted">If you do not see it within a few minutes, check spam or junk folders.</p>

        {rateLimited ? (
          <div className="mt-6 rounded-xl border border-gold/40 bg-[#fbf7ef] p-4">
            <p className="font-semibold text-forest-green">{RATE_LIMIT_TITLE}</p>
            <p className="mt-2 text-sm leading-6 text-muted">{RATE_LIMIT_BODY}</p>
          </div>
        ) : null}
        {status ? <p className="mt-5 text-sm break-words text-forest-green">{status}</p> : null}

        <button
          className="mt-6 min-h-11 w-full rounded-lg border border-forest-green/20 px-4 py-3 text-sm font-medium text-forest-green disabled:opacity-60"
          disabled={busy || cooldown || !email}
          type="button"
          onClick={() => void resend()}
        >
          {cooldown ? resendCooldownLabel(remainingMs) : busy ? "Sending..." : "Resend confirmation email"}
        </button>
        {!email ? (
          <p className="mt-2 text-xs text-muted">Return to Create Account if you need to enter your email again.</p>
        ) : null}
        <p className="mt-6 text-sm">
          <Link className="text-forest-green underline underline-offset-2" href="/login">
            Back to Sign In
          </Link>
        </p>
      </section>
    </main>
  );
}
