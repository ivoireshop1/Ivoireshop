import { uberDirectCredentials } from "@/src/lib/delivery/credentials";
import { verifyUberWebhookSignature } from "@/src/lib/delivery/providers/uber-direct";
import { applyUberWebhook } from "@/src/lib/delivery/uber-dispatch";

export async function POST(request: Request) {
  const rawBody = await request.text();
  const creds = uberDirectCredentials();
  if (!creds.webhookSigningKey) return Response.json({ ok: false }, { status: 503 });
  const signature = request.headers.get("x-uber-signature") || request.headers.get("x-postmates-signature");
  if (!verifyUberWebhookSignature(rawBody, signature, creds.webhookSigningKey)) {
    return Response.json({ ok: false }, { status: 401 });
  }
  let payload: Record<string, unknown> = {};
  try {
    const parsed = JSON.parse(rawBody);
    if (!parsed || typeof parsed !== "object") return Response.json({ ok: false }, { status: 400 });
    payload = parsed as Record<string, unknown>;
  } catch {
    return Response.json({ ok: false }, { status: 400 });
  }
  const result = await applyUberWebhook({ rawBody, payload });
  if (!result.ok) return Response.json({ ok: false }, { status: result.status });
  return Response.json({ ok: true });
}
