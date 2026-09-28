"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/src/lib/supabase/browser";
import { getPublicSiteUrl } from "@/src/lib/site";
import { completePasswordRecovery, revokeServerSession } from "@/src/lib/auth/password";
import { applyNewPasswordAndRevokeSession, canSetRecoveryPassword } from "@/src/lib/auth/recovery-session";

const PRIVACY_MESSAGE = "If an account exists for that email, we've sent password reset instructions.";

function recoveryRedirectTo() {
  return `${getPublicSiteUrl()}/auth/callback?next=${encodeURIComponent("/reset-password")}`;
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
  const [ready, setReady] = useState(false);
  const [checking, setChecking] = useState(stage === "set");
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    const supabase = createClient();
    const hash = typeof window !== "undefined" ? window.location.hash : "";
    const hashParams = new URLSearchParams(hash.replace(/^#/, ""));
    const hashError = hashParams.get("error") || hashParams.get("error_code");
    if (hashError) {
      router.replace("/reset-password?error=invalid");
      return;
    }

    let cancelled = false;
    let invalidTimer: ReturnType<typeof setTimeout> | undefined;
    async function hydrate() {
      if (invalid) {
        setChecking(false);
        return;
      }
      const { data: { session } } = await supabase.auth.getSession();
      if (cancelled) return;
      if (canSetRecoveryPassword({ stage, hasSession: Boolean(session) })) {
        setReady(true);
        setChecking(false);
        return;
      }
      if (stage === "set") {
        invalidTimer = setTimeout(() => {
          if (!cancelled) router.replace("/reset-password?error=invalid");
        }, 2500);
        return;
      }
      setReady(false);
      setChecking(false);
    }
    void hydrate();

    const { data } = supabase.auth.onAuthStateChange((event, session) => {
      if (canSetRecoveryPassword({ stage, event, hasSession: Boolean(session) })) {
        if (invalidTimer) clearTimeout(invalidTimer);
        setReady(true);
        setChecking(false);
      }
    });
    return () => {
      cancelled = true;
      if (invalidTimer) clearTimeout(invalidTimer);
      data.subscription.unsubscribe();
    };
  }, [invalid, router, stage]);

  async function requestReset(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmitting(true);
    setMessage("");
    const supabase = createClient();
    await supabase.auth.resetPasswordForEmail(email, { redirectTo: recoveryRedirectTo() });
    setIsSubmitting(false);
    setMessage(PRIVACY_MESSAGE);
  }

  async function setPasswordSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmitting(true);
    setMessage("");
    const supabase = createClient();
    const { data: { session } } = await supabase.auth.getSession();
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
    router.replace("/login?reset=success");
    router.refresh();
  }

  if (invalid) {
    return (
      <main className="mx-auto flex min-h-[70vh] w-full max-w-md items-center px-6 py-16">
        <section className="w-full rounded-2xl bg-surface p-8 shadow-sm">
          <p className="mb-3 text-sm font-medium uppercase tracking-[0.2em] text-gold">Ivoire Shop</p>
          <h1 className="text-3xl font-semibold text-forest-green">Reset link unavailable</h1>
          <p className="mt-4 text-sm leading-6 text-muted">This password reset link is invalid or has expired.</p>
          <Link className="mt-6 inline-flex min-h-11 items-center rounded-lg bg-forest-green px-4 py-3 text-sm font-semibold text-white" href="/reset-password">
            Request a new link
          </Link>
        </section>
      </main>
    );
  }

  if (checking && stage === "set") {
    return (
      <main className="mx-auto flex min-h-[70vh] w-full max-w-md items-center px-6 py-16">
        <p className="text-sm text-muted">Preparing your password reset...</p>
      </main>
    );
  }

  if (ready) {
    return (
      <main className="mx-auto flex min-h-[70vh] w-full max-w-md items-center px-6 py-16">
        <section className="w-full rounded-2xl bg-surface p-8 shadow-sm">
          <p className="mb-3 text-sm font-medium uppercase tracking-[0.2em] text-gold">Ivoire Shop</p>
          <h1 className="text-3xl font-semibold text-forest-green">Choose a new password</h1>
          <p className="mt-3 text-sm leading-6 text-muted">After you save, you will be signed out and must sign in with the new password.</p>
          <form className="mt-8 space-y-5" onSubmit={setPasswordSubmit}>
            <label className="block text-sm font-medium">
              New password
              <input autoComplete="new-password" className="mt-2 min-h-11 w-full rounded-lg border border-black/15 px-4 py-3" minLength={8} onChange={(event) => setPassword(event.target.value)} required type="password" value={password} />
            </label>
            <label className="block text-sm font-medium">
              Confirm new password
              <input autoComplete="new-password" className="mt-2 min-h-11 w-full rounded-lg border border-black/15 px-4 py-3" minLength={8} onChange={(event) => setConfirm(event.target.value)} required type="password" value={confirm} />
            </label>
            <button className="w-full rounded-lg bg-forest-green px-4 py-3 font-medium text-white disabled:opacity-60" disabled={isSubmitting} type="submit">
              {isSubmitting ? "Updating..." : "Update password"}
            </button>
          </form>
          {message ? <p className="mt-5 text-sm text-muted">{message}</p> : null}
        </section>
      </main>
    );
  }

  return (
    <main className="mx-auto flex min-h-[70vh] w-full max-w-md items-center px-6 py-16">
      <section className="w-full rounded-2xl bg-surface p-8 shadow-sm">
        <p className="mb-3 text-sm font-medium uppercase tracking-[0.2em] text-gold">Ivoire Shop</p>
        <h1 className="text-3xl font-semibold text-forest-green">Reset your password</h1>
        <form className="mt-8 space-y-5" onSubmit={requestReset}>
          <label className="block text-sm font-medium">
            Email
            <input className="mt-2 w-full rounded-lg border border-black/15 px-4 py-3" onChange={(event) => setEmail(event.target.value)} required type="email" value={email} />
          </label>
          <button className="w-full rounded-lg bg-forest-green px-4 py-3 font-medium text-white disabled:opacity-60" disabled={isSubmitting} type="submit">
            {isSubmitting ? "Please wait..." : "Send reset link"}
          </button>
        </form>
        {message ? <p className="mt-5 text-sm text-muted">{message}</p> : null}
        <Link className="mt-6 inline-block text-sm text-forest-green" href="/login">Back to login</Link>
      </section>
    </main>
  );
}
