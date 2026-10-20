import { NextResponse } from "next/server";
import { createClient } from "@/src/lib/supabase/server";
import {
  createSignedIvoireWebhookDiagnostic,
  selfSignedWebhookPreconditions,
  steelWebhookSelfSignedTargetUrl,
  summarizeWebhookSelfSignedResult,
} from "@/src/lib/payments/stripe-webhook-self-signed";

export const runtime = "nodejs";

const TIMEOUT_MS = 8000;

async function requirePaymentAdmin() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false as const, status: 401 };
  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).maybeSingle();
  if (profile?.role !== "admin") return { ok: false as const, status: 403 };
  return { ok: true as const, status: 200 };
}

export async function GET() {
  return NextResponse.json({ error: "Method not allowed." }, { status: 405 });
}

export async function POST(request: Request) {
  const auth = await requirePaymentAdmin();
  if (!auth.ok) {
    return NextResponse.json({ error: "Admin required." }, { status: auth.status });
  }

  const preflight = selfSignedWebhookPreconditions();
  if (!preflight.ok) {
    return NextResponse.json({
      result: "FAIL",
      httpStatus: 0,
      diagnosticCode: preflight.diagnosticCode,
    });
  }

  const signed = createSignedIvoireWebhookDiagnostic(preflight.webhookSecret);
  const target = steelWebhookSelfSignedTargetUrl(process.env, request.url);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const delivered = await fetch(target, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "stripe-signature": signed.header,
      },
      body: signed.rawBody,
      signal: controller.signal,
    });
    let parsed: unknown = null;
    try {
      parsed = await delivered.json();
    } catch {
      parsed = null;
    }
    return NextResponse.json(summarizeWebhookSelfSignedResult(delivered.status, parsed));
  } catch (error) {
    const timedOut = error instanceof Error && error.name === "AbortError";
    return NextResponse.json({
      result: "FAIL",
      httpStatus: 0,
      diagnosticCode: timedOut ? "timeout" : "fetch_failed",
    });
  } finally {
    clearTimeout(timer);
  }
}
