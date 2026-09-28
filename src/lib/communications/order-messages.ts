import "server-only";

import { sendTransactionalEmail, type EmailPayload } from "@/src/lib/email/send";
import { paymentProviderLabel, paymentStatusLabel } from "@/src/lib/orders/status";

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

export type ConfirmationOrder = {
  order_number: string;
  confirmation_code: string;
  customer_email: string;
  customer_name: string;
  payment_status: string;
  payment_method?: string | null;
  payment_provider?: string | null;
  fulfillment_method: string;
  subtotal?: number | string;
  shipping_cost?: number | string;
  discount_amount?: number | string;
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

export type PaidConfirmationOrder = ConfirmationOrder;

export type OrderEmailEvent = "confirmed" | "ready_for_pickup" | "shipped" | "delivered";

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character]!);
}

export function paymentMethodLabel(provider?: string | null, method?: string | null) {
  return paymentProviderLabel(provider, method);
}

export function paymentStatusCopy(status: string, provider?: string | null) {
  return paymentStatusLabel(status, provider);
}

function firstName(name: string) {
  const token = name.trim().split(/\s+/)[0] ?? "";
  return token || "there";
}

function money(value: number | string | undefined) {
  const amount = Number(value ?? 0);
  if (!Number.isFinite(amount) || amount < 0) return "$0.00";
  return `$${amount.toFixed(2)}`;
}

function formatDate(value?: string) {
  return value ? new Date(value).toLocaleString() : new Date().toLocaleString();
}

function deliveryLines(order: ConfirmationOrder) {
  if (order.fulfillment_method === "local_pickup") return [];
  return [
    order.shipping_address?.address_line_1,
    order.shipping_address?.address_line_2,
    [order.shipping_address?.city, order.shipping_address?.state, order.shipping_address?.postal_code].filter(Boolean).join(", "),
    order.shipping_address?.country,
  ].filter(Boolean).map(String);
}

function assertConfirmationOrder(order: ConfirmationOrder) {
  if (!Number.isFinite(Number(order.total)) || Number(order.total) < 0) throw new Error("Invalid order total.");
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(order.customer_email)) throw new Error("Invalid recipient.");
  if (!/^IVO-[0-9A-Z]{5}$/.test(order.confirmation_code)) throw new Error("Invalid confirmation code.");
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

export function prepareOrderConfirmation(order: ConfirmationOrder, options?: { test?: boolean; event?: OrderEmailEvent }): EmailPayload {
  assertConfirmationOrder(order);
  if (order.payment_status === "failed" && options?.event !== "ready_for_pickup" && options?.event !== "shipped" && options?.event !== "delivered") {
    throw new Error("Refusing to send a paid/confirmed email for a failed payment.");
  }
  return renderIvoireOrderEmail(order, options?.event ?? "confirmed", Boolean(options?.test));
}

export function preparePaidOrderConfirmation(order: ConfirmationOrder): EmailPayload {
  if (order.payment_status !== "paid") throw new Error("Order is not paid.");
  return prepareOrderConfirmation(order, { event: "confirmed" });
}

export function prepareOrderEmailPreview(order: ConfirmationOrder, event: OrderEmailEvent = "confirmed"): EmailPayload {
  assertConfirmationOrder(order);
  return renderIvoireOrderEmail(order, event, false);
}

export function prepareTestOrderConfirmation(to: string): EmailPayload {
  return renderIvoireOrderEmail({
    order_number: "IV-TEST",
    confirmation_code: "IVO-8K4P2",
    customer_email: to,
    customer_name: "Test Customer",
    payment_status: "pending",
    payment_method: "not_collected",
    payment_provider: null,
    fulfillment_method: "local_pickup",
    subtotal: "24.00",
    shipping_cost: "0.00",
    discount_amount: "0.00",
    total: "24.00",
    created_at: new Date().toISOString(),
    order_items: [{ product_name: "Test pantry item", product_price: "12.00", quantity: 2 }],
  }, "confirmed", true);
}

export function prepareFulfillmentEmail(order: ConfirmationOrder, status: string): EmailPayload | null {
  if (status === "ready_for_pickup") return prepareOrderConfirmation(order, { event: "ready_for_pickup" });
  if (status === "shipped") return prepareOrderConfirmation(order, { event: "shipped" });
  if (status === "delivered") return prepareOrderConfirmation(order, { event: "delivered" });
  return null;
}

function eventCopy(event: OrderEmailEvent, pickup: boolean) {
  if (event === "ready_for_pickup") {
    return {
      eyebrow: "Ready for pickup",
      heading: "Your order is ready",
      intro: "Your order is ready for pickup.",
      subject: "Your Ivoire Shop order is ready for pickup",
    };
  }
  if (event === "shipped") {
    return {
      eyebrow: "Out for delivery",
      heading: "Your order is on the way",
      intro: "We'll keep you updated as your order makes its way to you.",
      subject: "Your Ivoire Shop order is out for delivery",
    };
  }
  if (event === "delivered") {
    return {
      eyebrow: pickup ? "Completed" : "Delivered",
      heading: pickup ? "Your order was collected" : "Your order was delivered",
      intro: "Thank you for shopping with Ivoire Shop.",
      subject: "Your Ivoire Shop order is complete",
    };
  }
  return {
    eyebrow: "Order confirmed",
    heading: "Order confirmed",
    intro: "Thanks for shopping with Ivoire Shop.",
    subject: "Your Ivoire Shop order is confirmed",
  };
}

function renderIvoireOrderEmail(order: ConfirmationOrder, event: OrderEmailEvent, test: boolean): EmailPayload {
  const pickup = order.fulfillment_method === "local_pickup";
  const copy = eventCopy(event, pickup);
  const payment = paymentStatusCopy(order.payment_status, order.payment_provider);
  const method = paymentMethodLabel(order.payment_provider, order.payment_method);
  const date = formatDate(order.created_at);
  const address = deliveryLines(order);
  const items = order.order_items.map((item) => {
    const unit = Number(item.product_price ?? 0);
    const line = Number.isFinite(unit) ? unit * item.quantity : 0;
    return {
      name: item.product_name,
      quantity: item.quantity,
      price: money(item.product_price ?? 0),
      line: money(line),
    };
  });
  const shipping = Number(order.shipping_cost ?? 0);
  const discount = Number(order.discount_amount ?? 0);
  const subject = `${test ? "TEST — " : ""}${copy.subject} — ${order.confirmation_code}`.replace(/[\r\n]/g, " ");
  const text = [
    test ? "TEST EMAIL — not a live customer notice." : "",
    "IVOIRE SHOP",
    copy.heading,
    `Hi ${firstName(order.customer_name)},`,
    copy.intro,
    "",
    "YOUR CONFIRMATION CODE",
    order.confirmation_code,
    pickup ? "Keep this code handy. You may need it when picking up your order." : `Confirmation code: ${order.confirmation_code}`,
    pickup ? "Pickup selected" : "Delivery selected",
    pickup ? (event === "ready_for_pickup" ? "Your order is ready for pickup." : "We'll let you know when your order is ready.") : "",
    pickup ? `Bring your confirmation code with you: ${order.confirmation_code}` : "",
    ...(!pickup && address.length ? ["Delivery address:", ...address] : []),
    "",
    "ORDER DETAILS",
    `Order #: ${order.order_number}`,
    `Order date: ${date}`,
    pickup ? "Pickup" : "Delivery",
    `Payment method: ${method}`,
    `Payment status: ${payment}`,
    "",
    "ITEMS",
    ...items.map((item) => `${item.name} × ${item.quantity} @ ${item.price} = ${item.line}`),
    `Subtotal: ${money(order.subtotal ?? order.total)}`,
    shipping > 0 ? `Delivery fee: ${money(shipping)}` : "",
    discount > 0 ? `Discount: -${money(discount)}` : "",
    `Total: ${money(order.total)}`,
  ].filter((line, index, lines) => line !== "" || lines[index - 1] !== "").join("\n");

  const itemRows = items.map((item) => `<tr>
    <td style="padding:10px 0;border-bottom:1px solid #eadfce;color:#173f35">${escapeHtml(item.name)}</td>
    <td style="padding:10px 0;border-bottom:1px solid #eadfce;text-align:center;color:#173f35">${item.quantity}</td>
    <td style="padding:10px 0;border-bottom:1px solid #eadfce;text-align:right;color:#173f35">${item.price}</td>
    <td style="padding:10px 0;border-bottom:1px solid #eadfce;text-align:right;color:#173f35">${item.line}</td>
  </tr>`).join("");

  const html = `<div style="background:#f7f1e8;padding:24px 12px;font-family:Georgia,'Times New Roman',serif;color:#173f35">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:640px;margin:0 auto;background:#fffaf3;border:1px solid #eadfce;border-radius:24px">
    <tr><td style="padding:28px 28px 8px">
      ${test ? '<p style="margin:0 0 16px;padding:8px 12px;background:#b8964c;color:#fff;font-size:12px;letter-spacing:0.18em;text-transform:uppercase;border-radius:999px;display:inline-block">TEST</p>' : ""}
      <p style="margin:0;letter-spacing:0.28em;text-transform:uppercase;color:#b8964c;font-size:12px">Ivoire Shop</p>
      <h1 style="margin:12px 0 0;font-size:28px;line-height:1.2;color:#173f35">${escapeHtml(copy.heading)}</h1>
      <p style="margin:16px 0 0;font-size:16px">Hi ${escapeHtml(firstName(order.customer_name))},</p>
      <p style="margin:8px 0 0;color:#6b6b6b">${escapeHtml(copy.intro)}</p>
    </td></tr>
    <tr><td style="padding:8px 28px 24px">
      <div style="background:#173f35;color:#f7f1e8;border-radius:20px;padding:24px;text-align:center">
        <p style="margin:0;letter-spacing:0.22em;text-transform:uppercase;color:#b8964c;font-size:11px">Your confirmation code</p>
        <p style="margin:12px 0 0;font-size:32px;letter-spacing:0.18em;font-family:ui-monospace,Consolas,monospace">${escapeHtml(order.confirmation_code)}</p>
        <p style="margin:12px 0 0;color:#f7f1e8">${pickup ? "Keep this code handy. You may need it when picking up your order." : "Keep this code handy for your records."}</p>
      </div>
    </td></tr>
    <tr><td style="padding:0 28px 24px">
      ${pickup ? `<p style="margin:0;font-weight:700">Pickup selected</p>
      <p style="margin:8px 0 0;color:#6b6b6b">${event === "ready_for_pickup" ? "Your order is ready for pickup." : event === "delivered" ? "Thank you for collecting your order." : "We'll let you know when your order is ready."}</p>
      <p style="margin:8px 0 0">Bring your confirmation code with you: <strong>${escapeHtml(order.confirmation_code)}</strong></p>` : `<p style="margin:0;font-weight:700">Delivery selected</p>
      <p style="margin:8px 0 0">Order confirmation code: <strong>${escapeHtml(order.confirmation_code)}</strong></p>
      ${address.length ? `<p style="margin:12px 0 0;color:#6b6b6b">Delivery address<br />${address.map((line) => escapeHtml(line)).join("<br />")}</p>` : ""}`}
    </td></tr>
    <tr><td style="padding:0 28px 8px"><p style="margin:0;letter-spacing:0.18em;text-transform:uppercase;color:#b8964c;font-size:11px">Order details</p></td></tr>
    <tr><td style="padding:8px 28px 24px;color:#173f35">
      <p style="margin:0">Order # ${escapeHtml(order.order_number)}</p>
      <p style="margin:6px 0 0">Order date ${escapeHtml(date)}</p>
      <p style="margin:6px 0 0">${pickup ? "Pickup" : "Delivery"}</p>
      <p style="margin:6px 0 0">Payment method ${escapeHtml(method)}</p>
      <p style="margin:6px 0 0">${escapeHtml(payment)}</p>
    </td></tr>
    <tr><td style="padding:0 28px 28px">
      <p style="margin:0 0 12px;letter-spacing:0.18em;text-transform:uppercase;color:#b8964c;font-size:11px">Items</p>
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
        <tr style="color:#6b6b6b;font-size:12px">
          <td style="padding-bottom:8px">Product name</td>
          <td style="padding-bottom:8px;text-align:center">Qty</td>
          <td style="padding-bottom:8px;text-align:right">Price</td>
          <td style="padding-bottom:8px;text-align:right">Line total</td>
        </tr>
        ${itemRows}
      </table>
      <p style="margin:16px 0 0;text-align:right">Subtotal ${money(order.subtotal ?? order.total)}</p>
      ${shipping > 0 ? `<p style="margin:6px 0 0;text-align:right">Delivery fee ${money(shipping)}</p>` : ""}
      ${discount > 0 ? `<p style="margin:6px 0 0;text-align:right">Discount -${money(discount)}</p>` : ""}
      <p style="margin:10px 0 0;text-align:right;font-size:18px;font-weight:700">Total ${money(order.total)}</p>
    </td></tr>
  </table>
</div>`;

  return { to: order.customer_email, subject, text, html };
}

export async function deliverOrderMessage(message?: EmailPayload) {
  if (!message) return { sent: false as const, reason: "provider_not_configured" as const };
  return sendTransactionalEmail(message);
}
