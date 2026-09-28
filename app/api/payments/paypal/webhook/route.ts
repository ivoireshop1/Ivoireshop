import { NextResponse } from "next/server";
import { verifyPaypalWebhook } from "@/src/lib/payments/paypal";
import { applyVerifiedPayment, loadOrderById } from "@/src/lib/payments/record";
import { usdToCents } from "@/src/lib/payments/money";

export async function POST(request: Request) {
  const rawBody = await request.text();
  const valid = await verifyPaypalWebhook(request.headers, rawBody).catch(() => false);
  if (!valid) return NextResponse.json({ error: "Invalid signature." }, { status: 403 });

  let payload: {
    id?: string;
    event_type?: string;
    resource?: {
      id?: string;
      status?: string;
      amount?: { currency_code?: string; value?: string };
      custom_id?: string;
      supplementary_data?: { related_ids?: { order_id?: string } };
    };
  };
  try {
    payload = JSON.parse(rawBody) as typeof payload;
  } catch {
    return NextResponse.json({ error: "Invalid payload." }, { status: 400 });
  }

  const eventId = payload.id;
  const resource = payload.resource;
  if (!eventId || !resource) return NextResponse.json({ ok: true });

  const orderId = resource.custom_id;
  if (!orderId) return NextResponse.json({ ok: true });
  const order = await loadOrderById(orderId).catch(() => null);
  if (!order) return NextResponse.json({ ok: true });

  try {
    if (payload.event_type === "PAYMENT.CAPTURE.COMPLETED") {
      if (resource.status === "COMPLETED" && resource.amount?.currency_code === "USD" && resource.amount.value) {
        await applyVerifiedPayment({
          orderId: order.id,
          provider: "paypal",
          status: "paid",
          amountCents: usdToCents(resource.amount.value),
          providerPaymentId: resource.id,
          eventId: `paypal-${eventId}`,
        });
      }
    } else if (payload.event_type === "PAYMENT.CAPTURE.DENIED" || payload.event_type === "PAYMENT.CAPTURE.DECLINED") {
      await applyVerifiedPayment({
        orderId: order.id,
        provider: "paypal",
        status: "failed",
        providerPaymentId: resource.id,
        eventId: `paypal-${eventId}`,
      });
    } else if (payload.event_type === "PAYMENT.CAPTURE.REFUNDED") {
      await applyVerifiedPayment({
        orderId: order.id,
        provider: "paypal",
        status: "refunded",
        providerPaymentId: resource.id,
        eventId: `paypal-${eventId}`,
      });
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
