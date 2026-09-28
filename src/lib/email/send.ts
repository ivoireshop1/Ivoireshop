import "server-only";

export type EmailPayload = {
  to: string;
  subject: string;
  text: string;
  html: string;
};

export type EmailSendResult =
  | { sent: true; provider: string }
  | { sent: false; reason: "provider_not_configured" | "provider_error" | "invalid_recipient" };

function firstConfiguredProvider() {
  const from = (process.env.ORDER_EMAIL_FROM ?? process.env.EMAIL_FROM ?? "").trim();
  const resend = (process.env.RESEND_API_KEY ?? "").trim();
  const postmark = (process.env.POSTMARK_SERVER_TOKEN ?? "").trim();
  const sendgrid = (process.env.SENDGRID_API_KEY ?? "").trim();
  // Recommended later: Resend. Keep Postmark/SendGrid as compatible fallbacks.
  if (from && resend) return { name: "resend" as const, from, key: resend };
  if (from && postmark) return { name: "postmark" as const, from, key: postmark };
  if (from && sendgrid) return { name: "sendgrid" as const, from, key: sendgrid };
  return null;
}

export function getEmailProviderStatus() {
  const provider = firstConfiguredProvider();
  return {
    configured: Boolean(provider),
    provider: provider?.name ?? null,
    recommended: "resend" as const,
    recommendedVars: ["ORDER_EMAIL_FROM", "RESEND_API_KEY"] as const,
  };
}

function sanitizeEmailFailure(to: string, detail: string) {
  const domain = to.includes("@") ? to.slice(to.lastIndexOf("@") + 1) : "unknown";
  return { domain, detail: detail.slice(0, 180).replace(to, "[redacted]") };
}

export async function sendTransactionalEmail(payload: EmailPayload): Promise<EmailSendResult> {
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(payload.to)) {
    return { sent: false, reason: "invalid_recipient" };
  }
  const provider = firstConfiguredProvider();
  if (!provider) return { sent: false, reason: "provider_not_configured" };

  try {
    if (provider.name === "resend") {
      const response = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${provider.key}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: provider.from,
          to: payload.to,
          subject: payload.subject,
          html: payload.html,
          text: payload.text,
        }),
      });
      if (!response.ok) throw new Error(`resend_${response.status}`);
      return { sent: true, provider: provider.name };
    }
    if (provider.name === "postmark") {
      const response = await fetch("https://api.postmarkapp.com/email", {
        method: "POST",
        headers: {
          "X-Postmark-Server-Token": provider.key,
          Accept: "application/json",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          From: provider.from,
          To: payload.to,
          Subject: payload.subject,
          HtmlBody: payload.html,
          TextBody: payload.text,
          MessageStream: "outbound",
        }),
      });
      if (!response.ok) throw new Error(`postmark_${response.status}`);
      return { sent: true, provider: provider.name };
    }
    const response = await fetch("https://api.sendgrid.com/v3/mail/send", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${provider.key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        personalizations: [{ to: [{ email: payload.to }] }],
        from: { email: provider.from },
        subject: payload.subject,
        content: [
          { type: "text/plain", value: payload.text },
          { type: "text/html", value: payload.html },
        ],
      }),
    });
    if (!response.ok && response.status !== 202) throw new Error(`sendgrid_${response.status}`);
    return { sent: true, provider: provider.name };
  } catch (error) {
    const sanitized = sanitizeEmailFailure(payload.to, error instanceof Error ? error.message : "send_failed");
    console.error("[order-email] delivery failed", sanitized);
    return { sent: false, reason: "provider_error" };
  }
}
