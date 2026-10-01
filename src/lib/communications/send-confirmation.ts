import "server-only";

import { prepareOrderConfirmation, type ConfirmationOrder } from "@/src/lib/communications/order-messages";
import { sendTransactionalEmail } from "@/src/lib/email/send";

type ConfirmationRow = {
  order_number?: string;
  confirmation_code?: string;
  customer_email?: string;
  customer_name?: string;
  payment_status?: string;
  payment_method?: string | null;
  payment_provider?: string | null;
  fulfillment_method?: string;
  subtotal?: number | string;
  shipping_cost?: number | string;
  discount_amount?: number | string;
  tax_amount?: number | string;
  total?: number | string;
  created_at?: string;
  shipping_address?: ConfirmationOrder["shipping_address"];
  items?: ConfirmationOrder["order_items"] | string;
};

function itemsFrom(row: ConfirmationRow): ConfirmationOrder["order_items"] {
  const raw = row.items;
  if (Array.isArray(raw)) return raw;
  if (typeof raw === "string") {
    try {
      const parsed = JSON.parse(raw) as ConfirmationOrder["order_items"];
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }
  return [];
}

export function confirmationOrderFromRow(row: ConfirmationRow): ConfirmationOrder | null {
  if (!row.order_number || !row.confirmation_code || !row.customer_email || !row.customer_name || row.total == null || !row.fulfillment_method) {
    return null;
  }
  return {
    order_number: String(row.order_number),
    confirmation_code: String(row.confirmation_code),
    customer_email: String(row.customer_email),
    customer_name: String(row.customer_name),
    payment_status: String(row.payment_status ?? "pending"),
    payment_method: row.payment_method ?? null,
    payment_provider: row.payment_provider ?? null,
    fulfillment_method: String(row.fulfillment_method),
    subtotal: row.subtotal,
    shipping_cost: row.shipping_cost,
    discount_amount: row.discount_amount,
    tax_amount: row.tax_amount,
    total: row.total,
    created_at: row.created_at,
    shipping_address: row.shipping_address ?? null,
    order_items: itemsFrom(row),
  };
}

export async function trySendOrderConfirmation(row: ConfirmationRow) {
  try {
    const order = confirmationOrderFromRow(row);
    if (!order) return false;
    const message = prepareOrderConfirmation(order, { event: "confirmed" });
    const result = await sendTransactionalEmail(message);
    if (!result.sent) {
      console.error("[order-email] not sent", { orderNumber: order.order_number, reason: result.reason });
    }
    return result.sent;
  } catch (error) {
    console.error("[order-email] confirmation failed", {
      detail: error instanceof Error ? error.message.slice(0, 180) : "unknown",
    });
    return false;
  }
}
