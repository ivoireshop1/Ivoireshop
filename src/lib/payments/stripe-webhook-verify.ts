import Stripe from "stripe";
import { normalizeWebhookSecret } from "./stripe-config.ts";

export type StripeWebhookVerifyResult =
  | { ok: true; event: Stripe.Event }
  | { ok: false; error: string };

export function webhookSecretLooksValid(value: string) {
  return value.startsWith("whsec_") && !/\s/.test(value);
}

export function classifyStripeWebhookError(error: unknown) {
  const message = error instanceof Error ? error.message : "";
  if (message.includes("thin event notification")) return "thin_event";
  if (message.includes("Timestamp outside the tolerance zone")) return "timestamp_tolerance";
  if (message.includes("Unable to extract timestamp and signatures")) return "malformed_signature_header";
  if (message.includes("No stripe-signature header")) return "missing_signature_header";
  if (message.includes("No webhook payload")) return "missing_payload";
  if (message.includes("No signatures found matching the expected signature")) return "invalid_signature";
  if (message.includes("Unexpected token") || message.includes("Unexpected end of JSON")) return "invalid_payload";
  if (message.includes("No webhook secret value was provided")) return "missing_webhook_secret";
  return "construct_event_failed";
}

export function verifyStripeWebhookPayload(rawBody: string, signature: string | null, webhookSecret: string): StripeWebhookVerifyResult {
  const secret = normalizeWebhookSecret(webhookSecret);
  if (!secret) return { ok: false, error: "missing_webhook_secret" };
  if (/\s/.test(secret)) return { ok: false, error: "secret_whitespace" };
  if (!secret.startsWith("whsec_")) return { ok: false, error: "unrecognized_webhook_secret" };
  if (!signature) return { ok: false, error: "missing_signature_header" };
  if (!rawBody) return { ok: false, error: "missing_payload" };
  try {
    const event = Stripe.webhooks.constructEvent(rawBody, signature, secret);
    return { ok: true, event };
  } catch (error) {
    return { ok: false, error: classifyStripeWebhookError(error) };
  }
}
