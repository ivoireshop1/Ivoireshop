import Stripe from "stripe";
import { CANONICAL_PRODUCTION_ORIGIN } from "../site.ts";
import { getStripeConfig } from "./stripe-config.ts";

export const IVOIRE_WEBHOOK_SELF_SIGNED_EVENT_TYPE = "ivoire.diagnostic.webhook_self_signed";

const SAFE_CODES = new Set([
  "verified",
  "invalid_signature",
  "thin_event",
  "timestamp_tolerance",
  "malformed_signature_header",
  "missing_signature_header",
  "missing_payload",
  "invalid_payload",
  "missing_webhook_secret",
  "unrecognized_webhook_secret",
  "secret_whitespace",
  "construct_event_failed",
  "unconfigured",
  "process_failed",
  "live_payments_locked",
  "timeout",
  "fetch_failed",
  "unknown",
]);

export function isIvoireWebhookSelfSignedEvent(type: string | null | undefined) {
  return type === IVOIRE_WEBHOOK_SELF_SIGNED_EVENT_TYPE;
}

export function createIvoireWebhookSelfSignedPayload() {
  return JSON.stringify({
    id: `evt_diag_self_signed_${Date.now()}`,
    object: "event",
    type: IVOIRE_WEBHOOK_SELF_SIGNED_EVENT_TYPE,
    livemode: false,
    data: {
      object: {
        id: "diag_self_signed",
        object: "ivoire.diagnostic",
      },
    },
  });
}

export function steelWebhookSelfSignedTargetUrl(env = process.env, requestUrl?: string) {
  if (env.VERCEL_ENV === "production") {
    return `${CANONICAL_PRODUCTION_ORIGIN}/api/payments/stripe/webhook`;
  }
  if (requestUrl) {
    return new URL("/api/payments/stripe/webhook", requestUrl).toString();
  }
  return "http://127.0.0.1/api/payments/stripe/webhook";
}

export function summarizeWebhookSelfSignedResult(httpStatus: number, body: unknown) {
  let diagnosticCode = "unknown";
  if (httpStatus >= 200 && httpStatus < 300) diagnosticCode = "verified";
  else if (httpStatus === 503) diagnosticCode = "unconfigured";
  else if (httpStatus === 500) diagnosticCode = "process_failed";
  else if (body && typeof body === "object" && "code" in body && typeof body.code === "string" && SAFE_CODES.has(body.code)) {
    diagnosticCode = body.code;
  }
  return {
    result: httpStatus >= 200 && httpStatus < 300 ? "PASS" : "FAIL",
    httpStatus,
    diagnosticCode,
  };
}

export function createSignedIvoireWebhookDiagnostic(secret: string) {
  const rawBody = createIvoireWebhookSelfSignedPayload();
  const header = Stripe.webhooks.generateTestHeaderString({ payload: rawBody, secret });
  return { rawBody, header };
}

export function selfSignedWebhookPreconditions() {
  const config = getStripeConfig();
  if (config.livePaymentsEnabled) {
    return { ok: false as const, diagnosticCode: "live_payments_locked", webhookSecret: "" };
  }
  if (!config.webhookPresent || !config.webhookSecret) {
    return { ok: false as const, diagnosticCode: "missing_webhook_secret", webhookSecret: "" };
  }
  return { ok: true as const, diagnosticCode: null, webhookSecret: config.webhookSecret };
}
