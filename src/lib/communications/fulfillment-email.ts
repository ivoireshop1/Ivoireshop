import "server-only";

import { requireAdmin } from "@/src/lib/auth/guards";
import { prepareFulfillmentEmail, type ConfirmationOrder } from "@/src/lib/communications/order-messages";
import { sendTransactionalEmail } from "@/src/lib/email/send";

export async function notifyFulfillmentEmail(
  supabase: Awaited<ReturnType<typeof requireAdmin>>["supabase"],
  orderId: string,
  status: string,
) {
  if (status !== "ready_for_pickup" && status !== "shipped" && status !== "delivered") return;
  try {
    const { data: order, error } = await supabase
      .from("orders")
      .select("order_number, confirmation_code, customer_email, customer_name, payment_status, payment_method, payment_provider, fulfillment_method, subtotal, shipping_cost, discount_amount, total, created_at, shipping_address, order_items(product_name, product_price, quantity)")
      .eq("id", orderId)
      .maybeSingle();
    if (error || !order?.confirmation_code) {
      console.error("[order-email] fulfillment skipped", { reason: error ? "read_failed" : "missing_code" });
      return;
    }
    const payload: ConfirmationOrder = {
      ...order,
      order_items: order.order_items ?? [],
    };
    const message = prepareFulfillmentEmail(payload, status);
    if (!message) return;
    const result = await sendTransactionalEmail(message);
    if (!result.sent) console.error("[order-email] fulfillment not sent", { orderNumber: order.order_number, reason: result.reason });
  } catch (error) {
    console.error("[order-email] fulfillment failed", {
      detail: error instanceof Error ? error.message.slice(0, 180) : "unknown",
    });
  }
}
