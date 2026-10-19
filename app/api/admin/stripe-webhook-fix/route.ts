import { createHmac, timingSafeEqual } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { getStripeConfig } from "@/src/lib/payments/stripe-config";
import { stripeClient, verifyStripeWebhook } from "@/src/lib/payments/stripe-server";
import { createAdminClient } from "@/src/lib/supabase/admin";

export const runtime = "nodejs";

const CONFIRM = "preview-stripe-webhook-fix";
const REQUIRED_EVENTS = [
  "payment_intent.succeeded",
  "payment_intent.payment_failed",
  "payment_intent.canceled",
  "charge.refunded",
] as const;

function previewOnly() {
  return process.env.VERCEL_ENV === "preview";
}

function webhookUrlFromRequest(request: NextRequest) {
  const host = request.headers.get("x-forwarded-host") || request.headers.get("host") || "";
  const proto = request.headers.get("x-forwarded-proto") || "https";
  if (!host) return null;
  return `${proto}://${host}/api/payments/stripe/webhook`;
}

function signStripeBody(rawBody: string, secret: string) {
  const timestamp = Math.floor(Date.now() / 1000);
  const payload = `${timestamp}.${rawBody}`;
  const signature = createHmac("sha256", secret).update(payload, "utf8").digest("hex");
  return { header: `t=${timestamp},v1=${signature}`, timestamp };
}

async function readHealth() {
  const supabase = createAdminClient();
  if (!supabase) return null;
  const { data } = await supabase
    .from("payment_webhook_health")
    .select("last_success_at, last_error_at, last_error_code, recent_failures")
    .eq("provider", "stripe")
    .maybeSingle();
  return data;
}

async function listEndpoints() {
  const stripe = stripeClient();
  const listed = await stripe.webhookEndpoints.list({ limit: 30 });
  return listed.data.map((endpoint) => ({
    id: endpoint.id,
    url: endpoint.url,
    status: endpoint.status,
    livemode: endpoint.livemode,
    api_version: endpoint.api_version,
    enabled_events: endpoint.enabled_events,
  }));
}

export async function GET(request: NextRequest) {
  if (!previewOnly()) {
    return NextResponse.json({ error: "Preview only." }, { status: 404 });
  }
  const config = getStripeConfig();
  const targetUrl = webhookUrlFromRequest(request);
  let endpoints: Awaited<ReturnType<typeof listEndpoints>> = [];
  let listError: string | null = null;
  if (config.secretPresent && config.mode === "test" && !config.liveBlocked) {
    try {
      endpoints = await listEndpoints();
    } catch {
      listError = "Unable to list Stripe webhook endpoints.";
    }
  }
  const health = await readHealth().catch(() => null);
  const matching = endpoints.filter((endpoint) => endpoint.url === targetUrl);
  return NextResponse.json({
    vercelEnv: process.env.VERCEL_ENV,
    deploymentUrl: process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : null,
    targetWebhookUrl: targetUrl,
    stripe: {
      configured: config.configured,
      mode: config.mode,
      secretPresent: config.secretPresent,
      publishablePresent: config.publishablePresent,
      webhookPresent: config.webhookPresent,
      liveBlocked: config.liveBlocked,
    },
    deploymentProtection: {
      note: "Webhook route is excluded from auth proxy matcher; unsigned POST reaches app signature check.",
      proxyExcludesStripeWebhook: true,
    },
    endpoints,
    matchingEndpointCount: matching.length,
    urlMatchesActivePreview: matching.length > 0,
    listError,
    health,
    paymentEventsStripeCountHint: "query staging payment_events separately",
  });
}

export async function POST(request: NextRequest) {
  if (!previewOnly()) {
    return NextResponse.json({ error: "Preview only." }, { status: 404 });
  }
  const config = getStripeConfig();
  if (!config.configured || config.mode !== "test" || config.liveBlocked) {
    return NextResponse.json({ error: "Stripe TEST is not fully configured on this Preview." }, { status: 503 });
  }

  let body: { confirm?: string; action?: string } = {};
  try {
    body = (await request.json()) as { confirm?: string; action?: string };
  } catch {
    return NextResponse.json({ error: "JSON body required." }, { status: 400 });
  }
  if (body.confirm !== CONFIRM) {
    return NextResponse.json({ error: "confirm phrase required." }, { status: 403 });
  }

  const targetUrl = webhookUrlFromRequest(request);
  if (!targetUrl) {
    return NextResponse.json({ error: "Unable to resolve host." }, { status: 400 });
  }
  const stripe = stripeClient();
  const action = String(body.action || "");

  if (action === "self_signed_ping") {
    const eventObject = {
      id: `evt_diag_${Date.now()}`,
      object: "event",
      api_version: config.apiVersion,
      created: Math.floor(Date.now() / 1000),
      livemode: false,
      pending_webhooks: 1,
      request: { id: null, idempotency_key: null },
      type: "payment_intent.succeeded",
      data: {
        object: {
          id: `pi_diag_${Date.now()}`,
          object: "payment_intent",
          amount: 100,
          amount_received: 100,
          currency: "usd",
          status: "succeeded",
          metadata: { webhook_diag: "self_signed" },
        },
      },
    };
    const rawBody = JSON.stringify(eventObject);
    const signed = signStripeBody(rawBody, config.webhookSecret);
    const verified = verifyStripeWebhook(rawBody, signed.header);
    if (!verified) {
      return NextResponse.json({
        ok: false,
        stage: "local_constructEvent",
        error: "Installed STRIPE_WEBHOOK_SECRET could not verify a body signed with itself.",
      }, { status: 500 });
    }
    const delivered = await fetch(targetUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Stripe-Signature": signed.header,
      },
      body: rawBody,
    });
    const responseText = await delivered.text();
    const health = await readHealth().catch(() => null);
    return NextResponse.json({
      ok: delivered.ok,
      stage: "http_delivery",
      status: delivered.status,
      responseText: responseText.slice(0, 300),
      usedRawBody: true,
      usedStripeSignatureHeader: true,
      health,
      note: "Self-signed with Preview STRIPE_WEBHOOK_SECRET. PASS here proves raw-body + secret path; Stripe Dashboard endpoint must still share this secret.",
    });
  }

  if (action === "align_endpoint_url") {
    const endpoints = await stripe.webhookEndpoints.list({ limit: 30 });
    const testEndpoints = endpoints.data.filter((endpoint) => endpoint.livemode === false);
    if (!testEndpoints.length) {
      return NextResponse.json({
        ok: false,
        error: "No Stripe TEST webhook endpoints exist. Use create_endpoint.",
        targetUrl,
      }, { status: 404 });
    }
    const updated = [];
    for (const endpoint of testEndpoints) {
      if (endpoint.url === targetUrl) {
        updated.push({ id: endpoint.id, url: endpoint.url, changed: false });
        continue;
      }
      const next = await stripe.webhookEndpoints.update(endpoint.id, { url: targetUrl });
      updated.push({ id: next.id, url: next.url, changed: true, previousUrl: endpoint.url });
    }
    return NextResponse.json({
      ok: true,
      targetUrl,
      updated,
      note: "Signing secrets are unchanged when only the URL is updated.",
    });
  }

  if (action === "create_endpoint") {
    const created = await stripe.webhookEndpoints.create({
      url: targetUrl,
      enabled_events: [...REQUIRED_EVENTS],
      description: "Ivoire Shop Preview TEST webhook",
    });
    const secret = created.secret || "";
    return NextResponse.json({
      ok: Boolean(secret),
      endpointId: created.id,
      url: created.url,
      status: created.status,
      secretPresent: Boolean(secret),
      // Returned once for Vercel Preview env install; callers must not log/print it.
      secret,
      note: "Install secret into Vercel Preview STRIPE_WEBHOOK_SECRET, redeploy, then trigger_test_event.",
    });
  }

  if (action === "trigger_test_event") {
    const intent = await stripe.paymentIntents.create({
      amount: 100,
      currency: "usd",
      payment_method: "pm_card_visa",
      confirm: true,
      automatic_payment_methods: { enabled: true, allow_redirects: "never" },
      metadata: { webhook_diag: "stripe_delivery" },
      description: "Ivoire Preview webhook signature probe (no order)",
    });
    // Give Stripe a moment to deliver.
    await new Promise((resolve) => setTimeout(resolve, 2500));
    const health = await readHealth().catch(() => null);
    const endpoints = await listEndpoints();
    return NextResponse.json({
      ok: Boolean(health?.last_success_at),
      paymentIntentId: intent.id,
      paymentIntentStatus: intent.status,
      targetUrl,
      matchingEndpointCount: endpoints.filter((endpoint) => endpoint.url === targetUrl).length,
      health,
      note: "Genuine Stripe-signed delivery. Success requires endpoint URL + matching whsec in Preview.",
    });
  }

  if (action === "idempotency_probe") {
    const orderId = String((body as { orderId?: string }).orderId || "");
    const amountCents = Number((body as { amountCents?: number }).amountCents || 0);
    if (!orderId || !Number.isFinite(amountCents) || amountCents <= 0) {
      return NextResponse.json({ error: "orderId and amountCents required." }, { status: 400 });
    }
    const eventId = `evt_idem_${orderId.replace(/-/g, "").slice(0, 18)}`;
    const intentId = `pi_idem_${Date.now()}`;
    const eventObject = {
      id: eventId,
      object: "event",
      api_version: "2025-08-27.basil",
      created: Math.floor(Date.now() / 1000),
      livemode: false,
      pending_webhooks: 1,
      request: { id: null, idempotency_key: null },
      type: "payment_intent.succeeded",
      data: {
        object: {
          id: intentId,
          object: "payment_intent",
          amount: amountCents,
          amount_received: amountCents,
          currency: "usd",
          status: "succeeded",
          metadata: { order_id: orderId },
        },
      },
    };
    const rawBody = JSON.stringify(eventObject);
    const signed = signStripeBody(rawBody, config.webhookSecret);
    const first = await fetch(targetUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Stripe-Signature": signed.header },
      body: rawBody,
    });
    const firstText = await first.text();
    const second = await fetch(targetUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Stripe-Signature": signed.header },
      body: rawBody,
    });
    const secondText = await second.text();
    const supabase = createAdminClient();
    const events = supabase
      ? await supabase
          .from("payment_events")
          .select("provider_event_id, order_id, processed_at")
          .eq("provider", "stripe")
          .eq("provider_event_id", eventId)
      : { data: null };
    const order = supabase
      ? await supabase.from("orders").select("id, payment_status, amount_paid, provider_payment_id").eq("id", orderId).maybeSingle()
      : { data: null };
    return NextResponse.json({
      ok: first.ok && second.ok,
      eventId,
      first: { status: first.status, body: firstText.slice(0, 200) },
      second: { status: second.status, body: secondText.slice(0, 200) },
      paymentEventRows: events.data?.length ?? 0,
      order: order.data,
      note: "Same Stripe event id delivered twice; payment_events unique constraint should keep a single row and paid status once.",
    });
  }

  if (action === "compare_secret_to_created") {
    return NextResponse.json({ error: "Unsupported. Use create_endpoint then install secret in Vercel." }, { status: 400 });
  }

  // Tiny helper used by install scripts: confirm two secrets are equal without revealing them.
  if (action === "secrets_match") {
    const provided = String((body as { candidate?: string }).candidate || "");
    const left = Buffer.from(config.webhookSecret);
    const right = Buffer.from(provided);
    const match = left.length === right.length && left.length > 0 && timingSafeEqual(left, right);
    return NextResponse.json({ match, webhookPresent: config.webhookPresent });
  }

  return NextResponse.json({
    error: "Unknown action.",
    actions: ["self_signed_ping", "align_endpoint_url", "create_endpoint", "trigger_test_event", "secrets_match"],
  }, { status: 400 });
}
