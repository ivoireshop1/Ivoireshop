const CREDENTIAL = /^[A-Za-z0-9_-]{8,512}$/;

export function recoveryCredential(value: string | null | undefined) {
  const trimmed = String(value ?? "").trim();
  if (!CREDENTIAL.test(trimmed)) return "";
  return trimmed;
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

/**
 * Email apps and iPhone browsers open a reset link before the person does.
 * The page only posts the one-time credential when they choose to continue.
 */
export function recoveryContinueHtml(input: { tokenHash?: string; code?: string }) {
  const tokenHash = recoveryCredential(input.tokenHash);
  const code = recoveryCredential(input.code);
  const fields = tokenHash
    ? `<input type="hidden" name="token_hash" value="${escapeHtml(tokenHash)}" /><input type="hidden" name="type" value="recovery" />`
    : `<input type="hidden" name="code" value="${escapeHtml(code)}" />`;
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <meta name="referrer" content="no-referrer" />
  <title>Continue password reset</title>
</head>
<body style="margin:0;background:#f7f1e8;color:#173f35;font-family:Georgia,'Times New Roman',serif">
  <main style="max-width:28rem;margin:0 auto;padding:3rem 1.25rem">
    <p style="margin:0;letter-spacing:0.2em;text-transform:uppercase;color:#b8964c;font-size:0.75rem">Ivoire Shop</p>
    <h1 style="margin:0.75rem 0 0;font-size:1.75rem">Continue password reset</h1>
    <p style="margin:1rem 0 0;font-size:0.95rem;line-height:1.5;color:#5c5c5c">This reset link is ready. Continue to choose a new password. Opening the email does not use the link up.</p>
    <form method="post" action="/auth/callback/recovery" style="margin-top:1.5rem">
      ${fields}
      <button type="submit" style="min-height:2.75rem;width:100%;border:0;border-radius:0.75rem;background:#173f35;color:#fffaf3;font:inherit;font-weight:600">Continue</button>
    </form>
  </main>
</body>
</html>`;
}
