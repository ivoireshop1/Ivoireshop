export const MIN_PASSWORD_LENGTH = 8;

export type PasswordValidation =
  | { ok: true; password: string }
  | { ok: false; error: string };

export function validatePasswordChange(input: {
  nextPassword: string;
  confirmPassword: string;
}): PasswordValidation {
  const nextPassword = String(input.nextPassword ?? "");
  const confirmPassword = String(input.confirmPassword ?? "");
  if (nextPassword.length < MIN_PASSWORD_LENGTH) {
    return { ok: false, error: `Use at least ${MIN_PASSWORD_LENGTH} characters.` };
  }
  if (nextPassword !== confirmPassword) {
    return { ok: false, error: "The new passwords do not match." };
  }
  return { ok: true, password: nextPassword };
}
