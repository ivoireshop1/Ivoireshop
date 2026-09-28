import "server-only";

type Event = "received" | "status_updated" | "fulfilled" | "cancelled";
type MessageOrder = {
  order_number: string;
  customer_email: string;
  status: string;
  payment_status: string;
  fulfillment_method: string;
  total: number | string;
  order_items: { product_name: string; quantity: number }[];
};

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character]!);
}

export function prepareOrderMessage(event: Event, order: MessageOrder) {
  const titles = { received: "Order received", status_updated: "Order update", fulfilled: "Order completed", cancelled: "Order cancelled" };
  if (event === "fulfilled" && order.status !== "delivered") throw new Error("Order is not completed.");
  if (event === "cancelled" && order.status !== "cancelled") throw new Error("Order is not cancelled.");
  if (!Number.isFinite(Number(order.total)) || Number(order.total) < 0) throw new Error("Invalid order total.");
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(order.customer_email)) throw new Error("Invalid recipient.");
  const subject = `${titles[event]}: ${order.order_number}`.replace(/[\r\n]/g, " ");
  const text = [subject, `Status: ${order.status.replaceAll("_", " ")}`, `Payment: ${order.payment_status}`,
    `Fulfillment: ${order.fulfillment_method.replaceAll("_", " ")}`,
    ...order.order_items.map((item) => `${item.product_name} x ${item.quantity}`),
    `Total: $${Number(order.total).toFixed(2)}`,
    "Keep your order number for reference.",
  ].join("\n");
  return { to: order.customer_email, subject, text, html: `<div>${escapeHtml(text).replaceAll("\n", "<br />")}</div>` };
}

// Deliberately disconnected until a provider, verified sender, delivery ledger
// and retry policy are configured. Preparing a template never sends a message.
export async function deliverOrderMessage() {
  return { sent: false as const, reason: "provider_not_configured" as const };
}
