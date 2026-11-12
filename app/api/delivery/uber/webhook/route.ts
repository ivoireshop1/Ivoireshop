import { uberDirectCredentials } from "@/src/lib/delivery/credentials";
import { verifyUberWebhookSignature } from "@/src/lib/delivery/providers/uber-direct";
import { applyUberWebhook } from "@/src/lib/delivery/uber-dispatch";

export async function POST(request: Request) {
  const rawBody = await request.text();
  const creds = uberDirectCredentials();
  if (!creds.webhookSigningKey) return Response.json({ ok: false }, { status: 503 });
  const uberSignature = verifyUberWebhookSignature(rawBody, request.headers.get("x-uber-signature"), creds.webhookSigningKey);
  const postmatesSignature = verifyUberWebhookSignature(rawBody, request.headers.get("x-postmates-signature"), creds.webhookSigningKey);
  if (!uberSignature && !postmatesSignature) return Response.json({ ok: false }, { status: 401 });
  let payload: Record<string, unknown> = {};
  try {
    const parsed = JSON.parse(rawBody);
    if (!parsed || typeof parsed !== "object") return Response.json({ ok: false }, { status: 400 });
    payload = parsed as Record<string, unknown>;
  } catch {
    return Response.json({ ok: false }, { status: 400 });
  }
  const kind = String(payload.kind ?? payload.event_type ?? "");
  if (kind.includes("refund") && !uberSignature) return Response.json({ ok: false }, { status: 401 });
  const result = await applyUberWebhook({ rawBody, payload });
  if (!result.ok) return Response.json({ ok: false }, { status: result.status });
  return Response.json({ ok: true });
}
