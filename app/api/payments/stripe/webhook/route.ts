import { NextResponse } from "next/server";
import { getStripeConfig } from "@/src/lib/payments/stripe-config";
import { verifyStripeWebhook } from "@/src/lib/payments/stripe-server";
import { markWebhookHealth } from "@/src/lib/payments/record";
import { processStripeEvent } from "@/src/lib/payments/stripe-events";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const config = getStripeConfig();
  if (!config.configured) {
    return NextResponse.json({ error: "Stripe is not configured." }, { status: 503 });
  }
  const rawBody = await request.text();
  const signature = request.headers.get("stripe-signature");
  const event = verifyStripeWebhook(rawBody, signature);
  if (!event) {
    await markWebhookHealth("stripe", false, "invalid_signature").catch(() => undefined);
    return NextResponse.json({ error: "Invalid signature." }, { status: 400 });
  }
  try {
    await processStripeEvent(event);
    return NextResponse.json({ received: true });
  } catch {
    return NextResponse.json({ error: "Webhook processing failed." }, { status: 500 });
  }
}
