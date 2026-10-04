import "server-only";

import Stripe from "stripe";
import { getStripeConfig } from "./stripe-config";

let client: Stripe | null = null;

export function stripeClient() {
  const config = getStripeConfig();
  if (!config.secretKey) throw new Error("Stripe is not configured.");
  if (!client) {
    client = new Stripe(config.secretKey, {
      typescript: true,
    });
  }
  return client;
}

export function verifyStripeWebhook(rawBody: string, signature: string | null) {
  const config = getStripeConfig();
  if (!config.webhookSecret || !signature) return null;
  try {
    return stripeClient().webhooks.constructEvent(rawBody, signature, config.webhookSecret);
  } catch {
    return null;
  }
}
