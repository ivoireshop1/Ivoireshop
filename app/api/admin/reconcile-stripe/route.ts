import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/src/lib/supabase/server";
import { getStripeConfig } from "@/src/lib/payments/stripe-config";
import { hasPaymentAdminClient } from "@/src/lib/payments/config";
import { stripeClient } from "@/src/lib/payments/stripe-server";
import { applyVerifiedPayment, loadOrderById } from "@/src/lib/payments/record";
import { isDemoOrder } from "@/src/lib/payments/demo";

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Admin required." }, { status: 401 });
  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).maybeSingle();
  if (profile?.role !== "admin") return NextResponse.json({ error: "Admin required." }, { status: 403 });

  let orderId = "";
  try {
    const body = (await request.json()) as { orderId?: string };
    orderId = String(body.orderId || "");
  } catch {
    return NextResponse.json({ error: "orderId required." }, { status: 400 });
  }
  if (!uuid.test(orderId)) return NextResponse.json({ error: "Invalid order." }, { status: 400 });

  const stripe = getStripeConfig();
  if (!stripe.configured || !hasPaymentAdminClient()) {
    return NextResponse.json({ error: "Stripe is not configured." }, { status: 503 });
  }
  const order = await loadOrderById(orderId);
  if (!order) return NextResponse.json({ error: "Order not found." }, { status: 404 });
  if (isDemoOrder(order)) return NextResponse.json({ error: "Demo order." }, { status: 409 });
  if (order.payment_status === "paid") {
    return NextResponse.json({ success: true, payment_status: "paid", intent_status: "succeeded", duplicate: true });
  }
  const intentId = order.provider_payment_id;
  if (!intentId?.startsWith("pi_")) {
    return NextResponse.json({ error: "No PaymentIntent on this order." }, { status: 409 });
  }
  try {
    const intent = await stripeClient().paymentIntents.retrieve(intentId);
    if (intent.status === "succeeded") {
      await applyVerifiedPayment({
        orderId: order.id,
        provider: "stripe",
        status: "paid",
        amountCents: intent.amount_received || intent.amount,
        providerPaymentId: intent.id,
      });
      return NextResponse.json({ success: true, payment_status: "paid", intent_status: intent.status, duplicate: false });
    }
    return NextResponse.json({
      success: false,
      payment_status: order.payment_status,
      intent_status: intent.status,
      error: intent.status === "processing"
        ? "Stripe is still processing this payment. Do not charge again."
        : "Payment was not completed. Retry on the same order without creating a new one.",
    }, { status: 409 });
  } catch {
    return NextResponse.json({ error: "Unable to read PaymentIntent from Stripe." }, { status: 502 });
  }
}
