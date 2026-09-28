import { NextResponse } from "next/server";
import { getSquareConfig } from "@/src/lib/payments/config";
import { verifySquareWebhookSignature } from "@/src/lib/payments/square-signature";
import { applyVerifiedPayment, loadOrderById } from "@/src/lib/payments/record";
import { getPublicSiteUrl } from "@/src/lib/site";
function notificationUrl() {
  return `${getPublicSiteUrl()}/api/payments/square/webhook`;
}

export async function POST(request: Request) {
  const config = getSquareConfig();
  const rawBody = await request.text();
  const signature = request.headers.get("x-square-hmacsha256-signature") ?? "";
  if (!config.webhookSignatureKey || !verifySquareWebhookSignature({
    rawBody,
    signatureHeader: signature,
    signatureKey: config.webhookSignatureKey,
    notificationUrl: notificationUrl(),
  })) {
    return NextResponse.json({ error: "Invalid signature." }, { status: 403 });
  }

  let payload: {
    type?: string;
    event_id?: string;
    data?: { object?: { payment?: { id?: string; status?: string; amount_money?: { amount?: number; currency?: string }; reference_id?: string } } };
  };
  try {
    payload = JSON.parse(rawBody) as typeof payload;
  } catch {
    return NextResponse.json({ error: "Invalid payload." }, { status: 400 });
  }

  const payment = payload.data?.object?.payment;
  const eventId = payload.event_id;
  if (!payment?.id || !eventId) return NextResponse.json({ ok: true });

  const orderId = payment.reference_id;
  if (!orderId) return NextResponse.json({ ok: true });
  const order = await loadOrderById(orderId).catch(() => null);
  if (!order) return NextResponse.json({ ok: true });

  try {
    if (payload.type === "payment.updated" || payload.type === "payment.created") {
      if (payment.status === "COMPLETED" && payment.amount_money?.currency === "USD" && payment.amount_money.amount != null) {
        await applyVerifiedPayment({
          orderId: order.id,
          provider: "square",
          status: "paid",
          amountCents: payment.amount_money.amount,
          providerPaymentId: payment.id,
          eventId: `square-${eventId}`,
        });
      } else if (payment.status === "FAILED") {
        await applyVerifiedPayment({
          orderId: order.id,
          provider: "square",
          status: "failed",
          providerPaymentId: payment.id,
          eventId: `square-${eventId}`,
        });
      }
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (message.includes("does not match")) {
      return NextResponse.json({ ok: true, ignored: "amount_mismatch" });
    }
    return NextResponse.json({ error: "Webhook processing failed." }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
