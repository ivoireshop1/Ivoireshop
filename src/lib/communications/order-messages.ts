import "server-only";

import { sendTransactionalEmail, type EmailPayload } from "@/src/lib/email/send";

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

export type PaidConfirmationOrder = {
  order_number: string;
  confirmation_code: string;
  customer_email: string;
  customer_name: string;
  payment_status: string;
  payment_method: string | null;
  payment_provider: string | null;
  fulfillment_method: string;
  total: number | string;
  created_at?: string;
  shipping_address?: {
    address_line_1?: string;
    address_line_2?: string;
    city?: string;
    state?: string;
    postal_code?: string;
    country?: string;
  } | null;
  order_items: { product_name: string; product_price?: number | string; quantity: number }[];
};

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character]!);
}

function paymentLabel(provider: string | null, method: string | null) {
  if (provider === "square" || method === "square") return "Square";
  if (provider === "paypal" || method === "paypal") return "PayPal";
  return (method || provider || "Online payment").replaceAll("_", " ");
}

function firstName(name: string) {
  const token = name.trim().split(/\s+/)[0] ?? "";
  return token || "there";
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

export function preparePaidOrderConfirmation(order: PaidConfirmationOrder): EmailPayload {
  if (order.payment_status !== "paid") throw new Error("Order is not paid.");
  if (!Number.isFinite(Number(order.total)) || Number(order.total) < 0) throw new Error("Invalid order total.");
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(order.customer_email)) throw new Error("Invalid recipient.");
  if (!/^IVO-[0-9A-Z]{5}$/.test(order.confirmation_code)) throw new Error("Invalid confirmation code.");
  const pickup = order.fulfillment_method === "local_pickup";
  const method = paymentLabel(order.payment_provider, order.payment_method);
  const date = order.created_at ? new Date(order.created_at).toLocaleString() : new Date().toLocaleString();
  const address = pickup
    ? null
    : [
        order.shipping_address?.address_line_1,
        order.shipping_address?.address_line_2,
        [order.shipping_address?.city, order.shipping_address?.state, order.shipping_address?.postal_code].filter(Boolean).join(", "),
        order.shipping_address?.country,
      ].filter(Boolean);
  const itemLines = order.order_items.map((item) => {
    const price = item.product_price == null ? "" : ` @ $${Number(item.product_price).toFixed(2)}`;
    return `${item.product_name} × ${item.quantity}${price}`;
  });
  const subject = `Your Ivoire Shop order is confirmed — ${order.confirmation_code}`.replace(/[\r\n]/g, " ");
  const lines = [
    "Ivoire Shop",
    `Thank you, ${firstName(order.customer_name)}.`,
    `Confirmation code: ${order.confirmation_code}`,
    `Order number: ${order.order_number}`,
    `Order date: ${date}`,
    "",
    "Items",
    ...itemLines,
    `Total: $${Number(order.total).toFixed(2)}`,
    `Payment method: ${method}`,
    `Payment status: ${order.payment_status}`,
    `Fulfillment: ${pickup ? "Pickup" : "Delivery"}`,
    ...(address?.length ? ["Delivery address:", ...address] : []),
    pickup
      ? "Keep this confirmation code handy when picking up your order."
      : "We'll keep you updated as your order makes its way to you.",
  ];
  const text = lines.join("\n");
  const html = `<div style="font-family:Georgia,serif;background:#f7f1e8;color:#173f35;padding:24px">
    <p style="letter-spacing:0.2em;text-transform:uppercase;color:#b8964c;font-size:12px">Ivoire Shop</p>
    <h1 style="font-size:28px">Thank you, ${escapeHtml(firstName(order.customer_name))}.</h1>
    <p>Your order is confirmed.</p>
    <p style="font-size:22px;font-weight:700;letter-spacing:0.12em">${escapeHtml(order.confirmation_code)}</p>
    <p>Order number: ${escapeHtml(order.order_number)}</p>
    <p>Order date: ${escapeHtml(date)}</p>
    <h2 style="font-size:16px">Items</h2>
    ${itemLines.map((line) => `<p>${escapeHtml(line)}</p>`).join("")}
    <p><strong>Total: $${Number(order.total).toFixed(2)}</strong></p>
    <p>Payment method: ${escapeHtml(method)}</p>
    <p>Payment status: ${escapeHtml(order.payment_status)}</p>
    <p>${pickup ? "Pickup" : "Delivery"}</p>
    ${address?.length ? `<p>Delivery address<br />${address.map((line) => escapeHtml(String(line))).join("<br />")}</p>` : ""}
    <p>${pickup
      ? "Keep this confirmation code handy when picking up your order."
      : "We'll keep you updated as your order makes its way to you."}</p>
  </div>`;
  return { to: order.customer_email, subject, text, html };
}

export async function deliverOrderMessage(message?: EmailPayload) {
  if (!message) return { sent: false as const, reason: "provider_not_configured" as const };
  return sendTransactionalEmail(message);
}
