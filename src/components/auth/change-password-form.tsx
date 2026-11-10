"use client";

import { FormEvent, useState } from "react";
import { changeAuthenticatedPassword } from "@/src/lib/auth/password";
import { PasswordField } from "@/src/components/auth/password-field";

export function ChangePasswordForm() {
  const [nextPassword, setNextPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
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
        <PasswordField
          autoComplete="new-password"
          id="new-password"
          label="New password"
          onChange={setNextPassword}
          value={nextPassword}
        />
        <p className="mt-1 text-xs text-muted">At least 8 characters.</p>
      </div>
      <PasswordField
        autoComplete="new-password"
        id="confirm-password"
        label="Confirm new password"
        onChange={setConfirmPassword}
        value={confirmPassword}
      />
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
