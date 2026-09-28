"use client";

import { FormEvent, useState } from "react";
import { changeAuthenticatedPassword } from "@/src/lib/auth/password";

export function ChangePasswordForm() {
  const [nextPassword, setNextPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isSaving) return;
    setError("");
    setSuccess(false);
    setIsSaving(true);
    const result = await changeAuthenticatedPassword({ nextPassword, confirmPassword });
    setIsSaving(false);
    if (!result.success) {
      setError(result.error);
      return;
    }
    setNextPassword("");
    setConfirmPassword("");
    setSuccess(true);
  }

  return (
    <form className="max-w-md space-y-4" onSubmit={handleSubmit}>
      <div>
        <label className="block text-sm font-medium text-forest-green" htmlFor="new-password">
          New password
        </label>
        <div className="mt-2 flex gap-2">
          <input
            autoComplete="new-password"
            className="min-h-11 w-full min-w-0 rounded-lg border border-black/15 px-4 py-3"
            id="new-password"
            minLength={8}
            onChange={(event) => setNextPassword(event.target.value)}
            required
            type={showPassword ? "text" : "password"}
            value={nextPassword}
          />
          <button
            className="min-h-11 shrink-0 rounded-lg border border-forest-green/20 px-3 text-sm text-forest-green"
            onClick={() => setShowPassword((value) => !value)}
            type="button"
          >
            {showPassword ? "Hide" : "Show"}
          </button>
        </div>
        <p className="mt-1 text-xs text-muted">At least 8 characters.</p>
      </div>
      <label className="block text-sm font-medium text-forest-green" htmlFor="confirm-password">
        Confirm new password
        <input
          autoComplete="new-password"
          className="mt-2 min-h-11 w-full rounded-lg border border-black/15 px-4 py-3"
          id="confirm-password"
          minLength={8}
          onChange={(event) => setConfirmPassword(event.target.value)}
          required
          type={showPassword ? "text" : "password"}
          value={confirmPassword}
        />
      </label>
      <button
        className="min-h-11 w-full rounded-lg bg-forest-green px-4 py-3 font-medium text-white disabled:opacity-60"
        disabled={isSaving}
        type="submit"
      >
        {isSaving ? "Saving..." : "Update password"}
      </button>
      {error ? <p className="text-sm text-red-800">{error}</p> : null}
      {success ? <p className="text-sm text-forest-green">Your password has been updated.</p> : null}
    </form>
  );
}
