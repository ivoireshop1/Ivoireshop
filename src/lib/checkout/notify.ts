import "server-only";

import { createClient } from "@/src/lib/supabase/server";
import { prepareOrderConfirmation, deliverOrderMessage } from "@/src/lib/communications/order-messages";
import type { CheckoutReceipt } from "./checkout-validation";

function asItems(value: unknown): { product_name: string; product_price?: number | string; quantity: number }[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    if (!item || typeof item !== "object") return [];
    const row = item as Record<string, unknown>;
    if (typeof row.product_name !== "string") return [];
    const quantity = Number(row.quantity);
    if (!Number.isFinite(quantity) || quantity < 1) return [];
    return [{ product_name: row.product_name, product_price: row.product_price as number | string | undefined, quantity }];
  });
}

export async function notifyPlacedOrder(receipt: CheckoutReceipt) {
  const token = receipt.guest_access_token;
  if (!token) return false;
  try {
    const supabase = await createClient();
    const { data } = await supabase.rpc("get_checkout_confirmation", { p_access_token: token });
    const row = Array.isArray(data) ? data[0] : data;
    if (!row?.confirmation_code || row.payment_status === "failed") return false;
    const message = prepareOrderConfirmation({
      order_number: String(row.order_number),
      confirmation_code: String(row.confirmation_code),
      customer_email: String(row.customer_email),
      customer_name: String(row.customer_name),
      payment_status: String(row.payment_status),
      payment_method: row.payment_method ?? null,
      payment_provider: row.payment_provider ?? null,
      fulfillment_method: String(row.fulfillment_method),
      total: row.total,
      subtotal: row.subtotal,
      shipping_cost: row.shipping_cost,
      discount_amount: row.discount_amount,
      created_at: row.created_at,
      shipping_address: row.shipping_address,
      order_items: asItems(row.items),
    });
    const result = await deliverOrderMessage(message);
    if (!result.sent) {
      console.error("[order-email] not sent", { orderNumber: receipt.order_number, reason: result.reason });
    }
    return result.sent;
  } catch (error) {
    console.error("[order-email] confirmation failed", {
      orderNumber: receipt.order_number,
      detail: error instanceof Error ? error.message.slice(0, 180) : "unknown",
    });
    return false;
  }
}
