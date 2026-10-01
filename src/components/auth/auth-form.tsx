"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import { createClient } from "@/src/lib/supabase/browser";
import { useRouter } from "next/navigation";
import { resolveAuthRedirectTarget } from "@/src/lib/navigation/smart-navigation";
import { resolvePostLoginPath } from "@/src/lib/auth/post-login";
import { getAuthCallbackUrl } from "@/src/lib/site";
import { customerAuthPageCopy, publicAuthActionMessage, RATE_LIMIT_BODY, RATE_LIMIT_TITLE } from "@/src/lib/auth/customer-auth-messages";
import { PENDING_SIGNUP_EMAIL_KEY, RESEND_CONFIRM_AT_KEY } from "@/src/lib/auth/mask-email";
import { isAuthRateLimited, remainingResendMs, resendCooldownLabel } from "@/src/lib/auth/resend-cooldown";

type AuthMode = "login" | "signup" | "reset" | "update-password";

const content: Record<AuthMode, { title: string; submit: string }> = {
  login: { title: "Welcome back", submit: "Log in" },
  signup: { title: "Create your account", submit: "Sign up" },
  reset: { title: "Reset your password", submit: "Send reset link" },
  "update-password": { title: "Choose a new password", submit: "Update password" },
};

export default function AuthForm({
  mode,
  initialError,
  resetSuccess = false,
}: {
  mode: AuthMode;
  initialError?: string;
  resetSuccess?: boolean;
}) {
  const loginCopy = mode === "login" ? customerAuthPageCopy(initialError) : null;
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [message, setMessage] = useState(loginCopy?.body ?? "");
  const [resendHint, setResendHint] = useState(Boolean(loginCopy?.resend));
  const [rateLimited, setRateLimited] = useState(false);
  const [resendWaitMs, setResendWaitMs] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const router = useRouter();

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

  async function resendConfirmation() {
    if (!email) {
      setMessage("Enter the email you used to sign up, then request another confirmation.");
      setResendHint(true);
      return;
    }
    if (resendWaitMs > 0) return;
    setIsSubmitting(true);
    setMessage("");
    setRateLimited(false);
    const supabase = createClient();
    const nextTarget = resolveAuthRedirectTarget(
      new URLSearchParams(window.location.search),
      "/account",
    );
    const { error } = await supabase.auth.resend({
      type: "signup",
      email,
      options: { emailRedirectTo: getAuthCallbackUrl(nextTarget) },
    });
    setIsSubmitting(false);
    if (error) {
      if (isAuthRateLimited(error.message)) {
        setRateLimited(true);
        return;
      }
      setMessage(publicAuthActionMessage(error.message));
      return;
    }
    try {
      sessionStorage.setItem(RESEND_CONFIRM_AT_KEY, String(Date.now()));
    } catch { /* cooldown is best-effort */ }
    setResendWaitMs(remainingResendMs(Date.now()));
    setMessage("Fresh link sent! Check your inbox. ✉️");
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmitting(true);
    setMessage("");

    const supabase = createClient();
    const nextTarget = resolveAuthRedirectTarget(
      new URLSearchParams(window.location.search),
      "/account",
    );
    if (mode === "reset") {
      await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: getAuthCallbackUrl("/reset-password"),
      });
      setIsSubmitting(false);
      setMessage("If an account exists for that email, we've sent password reset instructions.");
      return;
    }
    const result =
      mode === "login"
        ? await supabase.auth.signInWithPassword({ email, password })
        : mode === "signup"
          ? await supabase.auth.signUp({
              email,
              password,
              options: {
                data: { full_name: fullName },
                emailRedirectTo: getAuthCallbackUrl(nextTarget),
              },
            })
          : await supabase.auth.updateUser({ password });

    setIsSubmitting(false);
    if (result.error) {
      const text = result.error.message.toLowerCase();
      if (isAuthRateLimited(result.error.message)) {
        setRateLimited(true);
        setResendHint(mode === "login" || mode === "signup");
        return;
      }
      setMessage(publicAuthActionMessage(result.error.message));
      setResendHint(mode === "login" && text.includes("email not confirmed"));
      return;
    }

    if (mode === "login") {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      const { data: profile } = user
        ? await supabase.from("profiles").select("role").eq("id", user.id).maybeSingle()
        : { data: null };
      router.push(resolvePostLoginPath(profile?.role, new URLSearchParams(window.location.search).get("next") ?? new URLSearchParams(window.location.search).get("returnTo")));
      router.refresh();
      return;
    }

    if (mode === "signup") {
      const identities = result.data.user?.identities ?? [];
      if (result.data.user && identities.length === 0) {
        setMessage("An account with this email already exists. Sign in, or reset your password if you forgot it.");
        return;
      }
      const session = "session" in result.data ? result.data.session : null;
      if (session && result.data.user) {
        const { data: profile } = await supabase.from("profiles").select("role").eq("id", result.data.user.id).maybeSingle();
        router.push(resolvePostLoginPath(profile?.role, nextTarget));
        router.refresh();
        return;
      }
      try {
        sessionStorage.setItem(PENDING_SIGNUP_EMAIL_KEY, email);
        sessionStorage.setItem(RESEND_CONFIRM_AT_KEY, String(Date.now()));
      } catch { /* email is only used locally for the check-email screen */ }
      router.push("/signup/check-email");
      return;
    }

    await supabase.auth.signOut({ scope: "global" });
    router.replace("/login?reset=success");
    router.refresh();
  }

  const copy = content[mode];
  return (
    <main className="mx-auto flex min-h-[70vh] w-full min-w-0 max-w-md items-center overflow-x-hidden px-4 py-12 sm:px-6 sm:py-16">
      <section className="w-full min-w-0 rounded-2xl bg-surface p-5 shadow-sm sm:p-8">
        <p className="mb-3 text-sm font-medium uppercase tracking-[0.2em] text-gold">
          Ivoire Shop
        </p>
        <h1 className="text-2xl font-semibold break-words text-forest-green sm:text-3xl">{copy.title}</h1>
        <form className="mt-8 space-y-5" onSubmit={handleSubmit}>
          {mode === "signup" && (
            <label className="block text-sm font-medium">
              Full name
              <input
                className="mt-2 min-h-11 w-full min-w-0 rounded-lg border border-black/15 px-4 py-3"
                value={fullName}
                onChange={(event) => setFullName(event.target.value)}
                required
              />
            </label>
          )}
          <label className="block text-sm font-medium">
            Email
            <input
              className="mt-2 min-h-11 w-full min-w-0 rounded-lg border border-black/15 px-4 py-3"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              required
            />
          </label>
          {mode !== "reset" && (
            <label className="block text-sm font-medium">
              Password
              <input
                autoComplete={mode === "login" ? "current-password" : "new-password"}
                className="mt-2 min-h-11 w-full min-w-0 rounded-lg border border-black/15 px-4 py-3"
                type="password"
                minLength={8}
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                required
              />
            </label>
          )}
          <button
            className="min-h-11 w-full rounded-lg bg-forest-green px-4 py-3 font-medium text-white disabled:opacity-60"
            disabled={isSubmitting}
            type="submit"
          >
            {isSubmitting ? "Please wait..." : copy.submit}
          </button>
        </form>
        {resetSuccess ? <p className="mt-5 text-sm break-words text-forest-green">Your password has been updated. Sign in with your new password.</p> : null}
        {rateLimited ? (
          <div className="mt-5 rounded-xl border border-gold/40 bg-[#fbf7ef] p-4">
            <p className="font-semibold text-forest-green">{RATE_LIMIT_TITLE}</p>
            <p className="mt-2 text-sm leading-6 text-muted">{RATE_LIMIT_BODY}</p>
          </div>
        ) : null}
        {message && <p className="mt-5 text-sm break-words text-muted">{message}</p>}
        {mode === "login" && resendHint ? (
          <button
            className="mt-3 min-h-11 w-full rounded-lg border border-forest-green/20 px-4 py-3 text-sm font-medium text-forest-green disabled:opacity-60"
            disabled={isSubmitting || resendWaitMs > 0}
            type="button"
            onClick={() => void resendConfirmation()}
          >
            {resendWaitMs > 0 ? resendCooldownLabel(resendWaitMs) : "Send another confirmation email"}
          </button>
        ) : null}
        <div className="mt-6 flex flex-wrap justify-between gap-3 text-sm text-forest-green">
          {mode === "login" ? (
            <>
              <Link href="/signup">Create account</Link>
              <Link href="/reset-password">Forgot password?</Link>
            </>
          ) : (
            <Link href="/login">Back to login</Link>
          )}
        </div>
      </section>
    </main>
  );
}
