"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/src/lib/supabase/browser";
import { getPasswordRecoveryCallbackUrl } from "@/src/lib/site";
import { completePasswordRecovery, revokeServerSession } from "@/src/lib/auth/password";
import {
  applyNewPasswordAndRevokeSession,
  canSetRecoveryPassword,
  parseRecoveryFragment,
} from "@/src/lib/auth/recovery-session";
import { RECOVERY_CALLBACK_PATH, RECOVERY_INVALID_PATH, RECOVERY_SET_PASSWORD_PATH } from "@/src/lib/auth/recovery";
import { isAuthRateLimited, remainingResendMs, resendCooldownLabel } from "@/src/lib/auth/resend-cooldown";
import { RESEND_CONFIRM_AT_KEY } from "@/src/lib/auth/mask-email";

const PRIVACY_MESSAGE = "If an account exists for that email, we've sent password reset instructions.";
const MISSING_ENV_MESSAGE =
  "This app is missing its Supabase connection settings. On Preview, redeploy with NEXT_PUBLIC_SUPABASE_URL and the public key. For local development, add them to .env.local.";
const RESET_EMAIL_KEY = "ivoire_password_reset_email";

function recoveryRedirectTo() {
  // Prefer the live browser origin so a Preview deployment never mails users back to
  // NEXT_PUBLIC_SITE_URL=http://localhost:3000 from a local env file.
  if (typeof window !== "undefined" && window.location.origin) {
    return `${window.location.origin.replace(/\/$/, "")}${RECOVERY_CALLBACK_PATH}`;
  }
  return getPasswordRecoveryCallbackUrl();
}

function tryCreateClient() {
  try {
    return { client: createClient(), error: null as string | null };
  } catch {
    return { client: null, error: MISSING_ENV_MESSAGE };
  }
}

export function PasswordRecoveryExperience({
  stage,
  invalid,
}: {
  stage?: string;
  invalid?: boolean;
}) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [message, setMessage] = useState("");
  const [configError, setConfigError] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const [checking, setChecking] = useState(stage === "set");
  const [consumingLink, setConsumingLink] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [emailSent, setEmailSent] = useState(false);
  const [rateLimited, setRateLimited] = useState(false);
  const [resendWaitMs, setResendWaitMs] = useState(0);

  useEffect(() => {
    try {
      const saved = sessionStorage.getItem(RESET_EMAIL_KEY);
      if (saved) setEmail(saved);
      const last = Number(sessionStorage.getItem(RESEND_CONFIRM_AT_KEY) ?? 0);
      setResendWaitMs(remainingResendMs(last || null));
    } catch {
      /* best-effort */
    }
  }, []);

  useEffect(() => {
    if (resendWaitMs <= 0) return;
    const timer = window.setInterval(() => {
      try {
        const last = Number(sessionStorage.getItem(RESEND_CONFIRM_AT_KEY) ?? 0);
        setResendWaitMs(remainingResendMs(last || null));
      } catch {
        setResendWaitMs(0);
      }
    }, 250);
    return () => window.clearInterval(timer);
  }, [resendWaitMs]);

  useEffect(() => {
    // PKCE codes that land on this page must go through the recovery callback.
    const search = new URLSearchParams(window.location.search);
    if (search.get("code") || (search.get("token_hash") && (search.get("type") === "recovery" || !search.get("type")))) {
      window.location.replace(`${RECOVERY_CALLBACK_PATH}?${search.toString()}`);
      return;
    }

    const hash = typeof window !== "undefined" ? window.location.hash : "";
    const hashParams = new URLSearchParams(hash.replace(/^#/, ""));
    const hashError = hashParams.get("error") || hashParams.get("error_code");
    if (hashError) {
      router.replace(RECOVERY_INVALID_PATH);
      return;
    }

    const fragment = parseRecoveryFragment(hash);
    const created = tryCreateClient();
    if (!created.client) {
      setConfigError(created.error);
      setChecking(false);
      return;
    }
    const supabase = created.client;

    let cancelled = false;
    let invalidTimer: ReturnType<typeof setTimeout> | undefined;
    async function hydrate() {
      if (fragment) {
        setConsumingLink(true);
        setChecking(true);
        const { data, error } = await supabase.auth.setSession({
          access_token: fragment.accessToken,
          refresh_token: fragment.refreshToken,
        });
        if (cancelled) return;
        if (data.session && !error) {
          window.history.replaceState(null, "", RECOVERY_SET_PASSWORD_PATH);
          setReady(true);
          setChecking(false);
          setConsumingLink(false);
          return;
        }
        setConsumingLink(false);
        router.replace(RECOVERY_INVALID_PATH);
        return;
      }
      if (invalid) {
        setChecking(false);
        return;
      }
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (cancelled) return;
      if (canSetRecoveryPassword({ stage, hasSession: Boolean(session) })) {
        setReady(true);
        setChecking(false);
        return;
      }
      if (stage === "set") {
        invalidTimer = setTimeout(() => {
          if (!cancelled) router.replace(RECOVERY_INVALID_PATH);
        }, 2500);
        return;
      }
      setReady(false);
      setChecking(false);
    }
    void hydrate();

    const { data } = supabase.auth.onAuthStateChange((event, session) => {
      if (
        canSetRecoveryPassword({
          stage,
          event,
          hasSession: Boolean(session),
          fromRecoveryLink: Boolean(fragment),
        })
      ) {
        if (invalidTimer) clearTimeout(invalidTimer);
        setReady(true);
        setChecking(false);
        setConsumingLink(false);
      }
    });
    return () => {
      cancelled = true;
      if (invalidTimer) clearTimeout(invalidTimer);
      data.subscription.unsubscribe();
    };
  }, [invalid, router, stage]);

  async function sendResetEmail(targetEmail: string) {
    const { client: supabase, error: clientError } = tryCreateClient();
    if (!supabase) {
      return { ok: false as const, error: clientError ?? MISSING_ENV_MESSAGE, rateLimited: false };
    }
    const { error } = await supabase.auth.resetPasswordForEmail(targetEmail, {
      redirectTo: recoveryRedirectTo(),
    });
    if (error) {
      if (isAuthRateLimited(error.message)) {
        return { ok: false as const, error: null, rateLimited: true };
      }
      return {
        ok: false as const,
        error: "We could not send a reset email right now. Try again in a moment.",
        rateLimited: false,
      };
    }
    try {
      sessionStorage.setItem(RESET_EMAIL_KEY, targetEmail);
      sessionStorage.setItem(RESEND_CONFIRM_AT_KEY, String(Date.now()));
    } catch {
      /* best-effort */
    }
    return { ok: true as const, error: null, rateLimited: false };
  }

  async function requestReset(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (resendWaitMs > 0) return;
    setIsSubmitting(true);
    setMessage("");
    setRateLimited(false);
    const result = await sendResetEmail(email.trim());
    setIsSubmitting(false);
    if (result.rateLimited) {
      setRateLimited(true);
      return;
    }
    if (!result.ok) {
      setMessage(result.error ?? PRIVACY_MESSAGE);
      return;
    }
    setEmailSent(true);
    setResendWaitMs(remainingResendMs(Date.now()));
    setMessage(PRIVACY_MESSAGE);
  }

  async function resendReset() {
    if (!email.trim() || resendWaitMs > 0) return;
    setIsSubmitting(true);
    setMessage("");
    setRateLimited(false);
    const result = await sendResetEmail(email.trim());
    setIsSubmitting(false);
    if (result.rateLimited) {
      setRateLimited(true);
      return;
    }
    if (!result.ok) {
      setMessage(result.error ?? PRIVACY_MESSAGE);
      return;
    }
    setEmailSent(true);
    setResendWaitMs(remainingResendMs(Date.now()));
    setMessage("If an account exists for that email, we've sent another reset link. Use the newest email.");
  }

  async function setPasswordSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isSubmitting) return;
    setIsSubmitting(true);
    setMessage("");
    const { client: supabase, error: clientError } = tryCreateClient();
    if (!supabase) {
      setIsSubmitting(false);
      setMessage(clientError ?? MISSING_ENV_MESSAGE);
      return;
    }
    const {
      data: { session },
    } = await supabase.auth.getSession();
    const result = session
      ? await applyNewPasswordAndRevokeSession(supabase, {
          nextPassword: password,
          confirmPassword: confirm,
        })
      : await completePasswordRecovery({ nextPassword: password, confirmPassword: confirm });
    if (!result.success) {
      setIsSubmitting(false);
      setMessage(result.error);
      return;
    }
    if (session) await revokeServerSession();
    if (!result.signedOut) {
      await supabase.auth.signOut({ scope: "global" });
    }
    try {
      sessionStorage.removeItem(RESET_EMAIL_KEY);
    } catch {
      /* best-effort */
    }
    router.replace("/login?reset=success");
    router.refresh();
  }

  if (configError) {
    return (
      <main className="mx-auto flex min-h-[70vh] w-full min-w-0 max-w-md items-center overflow-x-hidden px-4 py-12 sm:px-6 sm:py-16">
        <section className="w-full rounded-2xl bg-surface p-5 shadow-sm sm:p-8">
          <p className="mb-3 text-sm font-medium uppercase tracking-[0.2em] text-gold">Ivoire Shop</p>
          <h1 className="text-2xl font-semibold text-forest-green sm:text-3xl">Sign-in is not configured</h1>
          <p className="mt-4 text-sm leading-6 text-muted">{configError}</p>
          <Link className="mt-6 inline-flex min-h-11 items-center rounded-lg bg-forest-green px-4 py-3 text-sm font-semibold text-white" href="/login">
            Back to login
          </Link>
        </section>
      </main>
    );
  }

  if (consumingLink || (checking && stage === "set")) {
    return (
      <main className="mx-auto flex min-h-[70vh] w-full min-w-0 max-w-md items-center overflow-x-hidden px-4 py-12 sm:px-6 sm:py-16">
        <p className="text-sm text-muted">Preparing your password reset...</p>
      </main>
    );
  }

  if (invalid && !ready) {
    return (
      <main className="mx-auto flex min-h-[70vh] w-full min-w-0 max-w-md items-center overflow-x-hidden px-4 py-12 sm:px-6 sm:py-16">
        <section className="w-full rounded-2xl bg-surface p-5 shadow-sm sm:p-8">
          <p className="mb-3 text-sm font-medium uppercase tracking-[0.2em] text-gold">Ivoire Shop</p>
          <h1 className="text-2xl font-semibold text-forest-green sm:text-3xl">Reset link unavailable</h1>
          <p className="mt-4 text-sm leading-6 text-muted">
            This password reset link is invalid, expired, or was already used. Request a new one from Ivoire Shop, then open the newest email link.
          </p>
          <Link className="mt-6 inline-flex min-h-11 items-center rounded-lg bg-forest-green px-4 py-3 text-sm font-semibold text-white" href="/reset-password">
            Request a new link
          </Link>
        </section>
      </main>
    );
  }

  if (ready) {
    return (
      <main className="mx-auto flex min-h-[70vh] w-full min-w-0 max-w-md items-center overflow-x-hidden px-4 py-12 sm:px-6 sm:py-16">
        <section className="w-full rounded-2xl bg-surface p-5 shadow-sm sm:p-8">
          <p className="mb-3 text-sm font-medium uppercase tracking-[0.2em] text-gold">Ivoire Shop</p>
          <h1 className="text-2xl font-semibold text-forest-green sm:text-3xl">Choose a new password</h1>
          <p className="mt-3 text-sm leading-6 text-muted">After you save, you will be signed out and must sign in with the new password.</p>
          <form className="mt-8 space-y-5" onSubmit={setPasswordSubmit}>
            <label className="block text-sm font-medium">
              New password
              <input
                autoComplete="new-password"
                className="mt-2 min-h-11 w-full min-w-0 rounded-lg border border-black/15 px-4 py-3"
                minLength={8}
                onChange={(event) => setPassword(event.target.value)}
                required
                type="password"
                value={password}
              />
            </label>
            <label className="block text-sm font-medium">
              Confirm new password
              <input
                autoComplete="new-password"
                className="mt-2 min-h-11 w-full min-w-0 rounded-lg border border-black/15 px-4 py-3"
                minLength={8}
                onChange={(event) => setConfirm(event.target.value)}
                required
                type="password"
                value={confirm}
              />
            </label>
            <p className="text-xs leading-5 text-muted">Use at least 8 characters. Both fields must match.</p>
            <button className="min-h-11 w-full rounded-lg bg-forest-green px-4 py-3 font-medium text-white disabled:opacity-60" disabled={isSubmitting} type="submit">
              {isSubmitting ? "Updating..." : "Update password"}
            </button>
          </form>
          {message ? <p className="mt-5 text-sm text-muted">{message}</p> : null}
        </section>
      </main>
    );
  }

  if (emailSent) {
    return (
      <main className="mx-auto flex min-h-[70vh] w-full min-w-0 max-w-md items-center overflow-x-hidden px-4 py-12 sm:px-6 sm:py-16">
        <section className="w-full rounded-2xl bg-surface p-5 shadow-sm sm:p-8">
          <p className="mb-3 text-sm font-medium uppercase tracking-[0.2em] text-gold">Ivoire Shop</p>
          <h1 className="text-2xl font-semibold text-forest-green sm:text-3xl">Check your email</h1>
          <p className="mt-4 text-sm leading-6 text-muted">{message || PRIVACY_MESSAGE}</p>
          <p className="mt-3 text-sm leading-6 text-muted">Open the newest reset link from this same Steel site. The link expires, and reused links will not work.</p>
          {rateLimited ? (
            <div className="mt-5 rounded-xl border border-gold/40 bg-[#fbf7ef] p-4">
              <p className="font-semibold text-forest-green">Please wait before trying again</p>
              <p className="mt-2 text-sm leading-6 text-muted">Too many reset emails were requested. Wait a minute, then resend.</p>
            </div>
          ) : null}
          <button
            className="mt-6 min-h-11 w-full rounded-lg border border-forest-green/20 px-4 py-3 text-sm font-medium text-forest-green disabled:opacity-60"
            disabled={isSubmitting || resendWaitMs > 0 || !email.trim()}
            onClick={() => void resendReset()}
            type="button"
          >
            {resendWaitMs > 0 ? resendCooldownLabel(resendWaitMs) : isSubmitting ? "Please wait..." : "Resend reset email"}
          </button>
          <Link className="mt-6 inline-block text-sm text-forest-green" href="/login">
            Back to login
          </Link>
        </section>
      </main>
    );
  }

  return (
    <main className="mx-auto flex min-h-[70vh] w-full min-w-0 max-w-md items-center overflow-x-hidden px-4 py-12 sm:px-6 sm:py-16">
      <section className="w-full rounded-2xl bg-surface p-5 shadow-sm sm:p-8">
        <p className="mb-3 text-sm font-medium uppercase tracking-[0.2em] text-gold">Ivoire Shop</p>
        <h1 className="text-2xl font-semibold text-forest-green sm:text-3xl">Reset your password</h1>
        <p className="mt-3 text-sm leading-6 text-muted">Enter the email for your customer or admin account. We will send a secure reset link.</p>
        <form className="mt-8 space-y-5" onSubmit={requestReset}>
          <label className="block text-sm font-medium">
            Email
            <input
              autoComplete="email"
              className="mt-2 min-h-11 w-full min-w-0 rounded-lg border border-black/15 px-4 py-3"
              onChange={(event) => setEmail(event.target.value)}
              required
              type="email"
              value={email}
            />
          </label>
          <button className="min-h-11 w-full rounded-lg bg-forest-green px-4 py-3 font-medium text-white disabled:opacity-60" disabled={isSubmitting || resendWaitMs > 0} type="submit">
            {isSubmitting ? "Please wait..." : resendWaitMs > 0 ? resendCooldownLabel(resendWaitMs) : "Send reset link"}
          </button>
        </form>
        {rateLimited ? (
          <div className="mt-5 rounded-xl border border-gold/40 bg-[#fbf7ef] p-4">
            <p className="font-semibold text-forest-green">Please wait before trying again</p>
            <p className="mt-2 text-sm leading-6 text-muted">Too many reset emails were requested. Wait a minute, then try again.</p>
          </div>
        ) : null}
        {message ? <p className="mt-5 text-sm text-muted">{message}</p> : null}
        <Link className="mt-6 inline-block text-sm text-forest-green" href="/login">
          Back to login
        </Link>
      </section>
    </main>
  );
}
