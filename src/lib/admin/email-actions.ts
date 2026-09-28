"use server";

import { redirect } from "next/navigation";
import { requireAdmin } from "@/src/lib/auth/guards";
import { prepareOrderEmailPreview, prepareTestOrderConfirmation, type ConfirmationOrder, type OrderEmailEvent } from "@/src/lib/communications/order-messages";
import { getEmailProviderStatus, sendTransactionalEmail } from "@/src/lib/email/send";

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function getAdminOrderEmailPreview(orderId: string, event: OrderEmailEvent = "confirmed") {
  const { supabase } = await requireAdmin();
  if (!uuid.test(orderId)) throw new Error("Order not found.");
  const { data: order, error } = await supabase
    .from("orders")
    .select("order_number, confirmation_code, customer_email, customer_name, payment_status, payment_method, payment_provider, fulfillment_method, subtotal, shipping_cost, discount_amount, total, created_at, shipping_address, order_items(product_name, product_price, quantity)")
    .eq("id", orderId)
    .maybeSingle();
  if (error) throw new Error("Unable to load this order email.");
  if (!order?.confirmation_code) throw new Error("Order not found.");
  const payload: ConfirmationOrder = { ...order, order_items: order.order_items ?? [] };
  return prepareOrderEmailPreview(payload, event);
}

export async function sendAdminTestEmail(formData: FormData) {
  await requireAdmin();
  const email = getEmailProviderStatus();
  const to = String(formData.get("recipient") ?? "").trim().toLowerCase();
  if (!email.configured) redirect("/admin/payments?error=email_not_configured");
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to)) redirect("/admin/payments?error=invalid_test_recipient");
  const result = await sendTransactionalEmail(prepareTestOrderConfirmation(to));
  if (!result.sent) redirect("/admin/payments?error=test_email_failed");
  redirect("/admin/payments?success=test_email_sent");
}
