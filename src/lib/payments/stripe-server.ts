import "server-only";

import Stripe from "stripe";
import { getStripeConfig } from "./stripe-config";
import { verifyStripeWebhookPayload } from "./stripe-webhook-verify";

let client: Stripe | null = null;

export function stripeClient() {
  const config = getStripeConfig();
  if (config.liveBlocked) throw new Error("Live Stripe charges are locked until founder approval.");
  if (!config.canCollect || config.invalidKeyType || !config.secretKey) {
    throw new Error("Stripe is not configured.");
  }
  if (!client) {
    client = new Stripe(config.secretKey, {
      typescript: true,
    });
  }
  return client;
}

export function verifyStripeWebhook(rawBody: string, signature: string | null) {
  const config = getStripeConfig();
  const result = verifyStripeWebhookPayload(rawBody, signature, config.webhookSecret);
  return result.ok ? result.event : null;
}

export function inspectStripeWebhook(rawBody: string, signature: string | null) {
  const config = getStripeConfig();
  return verifyStripeWebhookPayload(rawBody, signature, config.webhookSecret);
}
