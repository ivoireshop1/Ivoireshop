import { NextResponse } from "next/server";
import { createClient } from "@/src/lib/supabase/server";
import { getStripeConfig, stripeKeyMode } from "@/src/lib/payments/stripe-config";
import { shippoCredentials } from "@/src/lib/shipping/shippo";
import { hasPaymentAdminClient } from "@/src/lib/payments/config";

export const runtime = "nodejs";

function safeEnv(name: string) {
  const raw = (process.env[name] ?? "").trim();
  const present = Boolean(raw);
  let mode: string | null = null;
  if (name.includes("STRIPE") && present) mode = stripeKeyMode(raw);
  if (name === "SHIPPO_API_TOKEN" && present) {
    mode = raw.startsWith("shippo_test_")
      ? "shippo_test"
      : raw.startsWith("shippo_live_")
        ? "shippo_live"
        : "shippo_other";
  }
  return {
    name,
    present,
    length: present ? raw.length : 0,
    prefix: present ? raw.slice(0, 8) : "",
    mode,
  };
}

/** Admin-only: boolean/prefix/mode diagnostics. Never returns secret values. */
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
      secretMode: stripe.secretPresent ? stripeKeyMode(stripe.secretKey) : null,
      publishableMode: stripe.publishablePresent ? stripeKeyMode(stripe.publishableKey) : null,
      modeMismatch: stripe.modeMismatch,
      mode: stripe.mode,
      livePaymentsEnabled: stripe.livePaymentsEnabled,
      liveBlocked: stripe.liveBlocked,
      canCollect: stripe.canCollect,
      configured: stripe.configured,
      canRecordOrders: hasPaymentAdminClient(),
      missingNames: stripe.missingNames,
      failPath: !stripe.publishablePresent
        ? "getStripeConfig → publishablePresent=false → canCollect=false (client never receives pk_*)"
        : !stripe.secretPresent
          ? "getStripeConfig → secretPresent=false → canCollect=false"
          : stripe.modeMismatch
            ? "getStripeConfig → modeMismatch=true (pk_* and sk_* modes differ or unrecognized)"
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
            ? "shippoCredentials → token present but not shippo_test_/shippo_live_ prefix"
            : null,
      note: "TEST tokens (shippo_test_) are accepted for quotes. LIVE tokens are intentionally blocked for checkout quotes.",
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
