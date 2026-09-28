"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { createClient } from "@/src/lib/supabase/browser";
import { useRouter } from "next/navigation";
import { resolveAuthRedirectTarget } from "@/src/lib/navigation/smart-navigation";
import { resolvePostLoginPath } from "@/src/lib/auth/post-login";
import { getPublicSiteUrl } from "@/src/lib/site";

type AuthMode = "login" | "signup" | "reset" | "update-password";

const content: Record<AuthMode, { title: string; submit: string }> = {
  login: { title: "Welcome back", submit: "Log in" },
  signup: { title: "Create your account", submit: "Sign up" },
  reset: { title: "Reset your password", submit: "Send reset link" },
  "update-password": { title: "Choose a new password", submit: "Update password" },
};

export default function AuthForm({ mode }: { mode: AuthMode }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [message, setMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const router = useRouter();
  const searchParams = typeof window !== "undefined" ? new URLSearchParams(window.location.search) : new URLSearchParams();
  const resetSuccess = searchParams.get("reset") === "success";

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmitting(true);
    setMessage("");

    const supabase = createClient();
    const nextTarget = resolveAuthRedirectTarget(searchParams, "/account");
    if (mode === "reset") {
      await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${getPublicSiteUrl()}/auth/callback?next=${encodeURIComponent("/reset-password")}`,
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
                emailRedirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(nextTarget)}`,
              },
            })
          : await supabase.auth.updateUser({ password });

    setIsSubmitting(false);
    if (result.error) {
      setMessage(result.error.message);
      return;
    }

    if (mode === "login") {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      const { data: profile } = user
        ? await supabase.from("profiles").select("role").eq("id", user.id).maybeSingle()
        : { data: null };
      router.push(resolvePostLoginPath(profile?.role, searchParams.get("next") ?? searchParams.get("returnTo")));
      router.refresh();
      return;
    }

    if (mode === "signup") {
      setMessage("Welcome to Ivoire Shop. Check your email to confirm your account and continue.");
      return;
    }

    setMessage("Your password has been updated.");
  }

  const copy = content[mode];
  return (
    <main className="mx-auto flex min-h-[70vh] w-full max-w-md items-center px-6 py-16">
      <section className="w-full rounded-2xl bg-surface p-8 shadow-sm">
        <p className="mb-3 text-sm font-medium uppercase tracking-[0.2em] text-gold">
          Ivoire Shop
        </p>
        <h1 className="text-3xl font-semibold text-forest-green">{copy.title}</h1>
        <form className="mt-8 space-y-5" onSubmit={handleSubmit}>
          {mode === "signup" && (
            <label className="block text-sm font-medium">
              Full name
              <input
                className="mt-2 w-full rounded-lg border border-black/15 px-4 py-3"
                value={fullName}
                onChange={(event) => setFullName(event.target.value)}
                required
              />
            </label>
          )}
          <label className="block text-sm font-medium">
            Email
            <input
              className="mt-2 w-full rounded-lg border border-black/15 px-4 py-3"
              type="email"
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
                className="mt-2 min-h-11 w-full rounded-lg border border-black/15 px-4 py-3"
                type="password"
                minLength={8}
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                required
              />
            </label>
          )}
          <button
            className="w-full rounded-lg bg-forest-green px-4 py-3 font-medium text-white disabled:opacity-60"
            disabled={isSubmitting}
            type="submit"
          >
            {isSubmitting ? "Please wait..." : copy.submit}
          </button>
        </form>
        {resetSuccess ? <p className="mt-5 text-sm text-forest-green">Your password has been updated. Sign in with your new password.</p> : null}
        {message && <p className="mt-5 text-sm text-muted">{message}</p>}
        <div className="mt-6 flex justify-between text-sm text-forest-green">
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
