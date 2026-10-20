import { NextResponse } from "next/server";
import { createClient } from "@/src/lib/supabase/server";
import { getStripeConfig, stripeKeyMode, STRIPE_ENV_NAMES } from "@/src/lib/payments/stripe-config";
import { shippoCredentials } from "@/src/lib/shipping/shippo";
import { hasPaymentAdminClient } from "@/src/lib/payments/config";

export const runtime = "nodejs";

function envMode(name: string, raw: string): string | null {
  if (!raw) return null;
  if (name === "STRIPE_WEBHOOK_SECRET") {
    return raw.startsWith("whsec_") ? "whsec" : "unrecognized";
  }
  if (name === STRIPE_ENV_NAMES.publishable || name === STRIPE_ENV_NAMES.secret) {
    return stripeKeyMode(raw) ?? "unrecognized";
  }
  if (name === "SHIPPO_API_TOKEN") {
    if (raw.startsWith("shippo_test_")) return "shippo_test";
    if (raw.startsWith("shippo_live_")) return "shippo_live";
    return "shippo_other";
  }
  if (name === "STRIPE_LIVE_PAYMENTS_ENABLED") {
    return raw.toLowerCase() === "true" ? "true" : "false";
  }
  return "present";
}

function safeEnv(name: string) {
  const raw = (process.env[name] ?? "").trim();
  return {
    name,
    present: Boolean(raw),
    mode: envMode(name, raw),
  };
}

/** Admin-only: presence/mode diagnostics. Never returns secret values, prefixes, or lengths. */
export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Admin required." }, { status: 401 });
  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).maybeSingle();
  if (profile?.role !== "admin") return NextResponse.json({ error: "Admin required." }, { status: 403 });

  const stripe = getStripeConfig();
  const shippo = shippoCredentials();
  const publishableMode = stripe.publishablePresent ? stripeKeyMode(stripe.publishableKey) : null;
  const secretMode = stripe.secretPresent ? stripeKeyMode(stripe.secretKey) : null;
  const unrecognizedKeys =
    (stripe.publishablePresent && !publishableMode) || (stripe.secretPresent && !secretMode);

  return NextResponse.json({
    deployment: {
      vercelEnv: process.env.VERCEL_ENV ?? null,
      vercelUrl: process.env.VERCEL_URL ?? null,
      gitSha: process.env.VERCEL_GIT_COMMIT_SHA ?? null,
    },
    stripe: {
      secretPresent: stripe.secretPresent,
      publishablePresent: stripe.publishablePresent,
      webhookPresent: stripe.webhookPresent,
      secretMode,
      publishableMode,
      modeMismatch: stripe.modeMismatch,
      mode: stripe.mode,
      livePaymentsEnabled: stripe.livePaymentsEnabled,
      liveBlocked: stripe.liveBlocked,
      canCollect: stripe.canCollect,
      configured: stripe.configured,
      canRecordOrders: hasPaymentAdminClient(),
      missingNames: stripe.missingNames,
      failPath: !stripe.publishablePresent
        ? "getStripeConfig → publishablePresent=false → canCollect=false"
        : !stripe.secretPresent
          ? "getStripeConfig → secretPresent=false → canCollect=false"
          : unrecognizedKeys
            ? "getStripeConfig → unrecognized Stripe key format (expect pk_test_/sk_test_ or pk_live_/sk_live_)"
            : stripe.modeMismatch
              ? "getStripeConfig → modeMismatch=true (publishable and secret modes differ)"
              : stripe.liveBlocked
                ? "getStripeConfig → liveBlocked (live keys with STRIPE_LIVE_PAYMENTS_ENABLED≠true)"
                : !stripe.webhookPresent
                  ? "getStripeConfig → webhookPresent=false → configured=false"
                  : null,
    },
    shippo: {
      configured: shippo.configured,
      mode: shippo.mode,
      isTest: shippo.isTest,
      isLive: shippo.isLive,
      failPath: !shippo.configured
        ? "shippoCredentials → empty SHIPPO_API_TOKEN → live-quotes returns not_configured"
        : shippo.isLive
          ? "live-quotes → isLive token blocked until founder approves production shipping"
          : shippo.mode === "unknown"
            ? "shippoCredentials → token present but not shippo_test_/shippo_live_ format"
            : null,
      note: "TEST tokens are accepted for quotes. LIVE tokens are intentionally blocked for checkout quotes.",
    },
    envPresence: [
      "NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY",
      "STRIPE_SECRET_KEY",
      "STRIPE_WEBHOOK_SECRET",
      "STRIPE_LIVE_PAYMENTS_ENABLED",
      "SHIPPO_API_TOKEN",
      "NEXT_PUBLIC_SITE_URL",
      "NEXT_PUBLIC_SUPABASE_URL",
      "NEXT_PUBLIC_SUPABASE_ANON_KEY",
      "SUPABASE_SERVICE_ROLE_KEY",
    ].map(safeEnv),
  });
}
