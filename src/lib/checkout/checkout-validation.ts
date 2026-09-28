export type CheckoutRequest = {
  items: { product_id: string; quantity: number }[];
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  address: { address_line_1?: string; address_line_2?: string; city?: string; state?: string; postal_code?: string; country?: string };
  fulfillmentMethod: "delivery" | "local_pickup";
  idempotencyKey: string;
};
export type CheckoutReceipt = {
  order_id: string;
  order_number: string;
  status: string;
  total: number;
  confirmation_code?: string;
  guest_access_token?: string;
  payment_status?: string;
  fulfillment_method?: string;
  customer_email?: string;
  customer_name?: string;
  payment_method?: string | null;
  payment_provider?: string | null;
  email_sent?: boolean;
};
export type CheckoutResponse = { success: true; receipt: CheckoutReceipt } | { success: false; error: string; retrySame: boolean };
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function validateCheckout(input: unknown): { request: CheckoutRequest; error?: never } | { error: string; request?: never } {
  if (!input || typeof input !== "object") return { error: "Invalid checkout request." };
  const value = input as Record<string, unknown>;
  const text = (key: string, max: number) => typeof value[key] === "string" && value[key].length <= max ? value[key].trim() : "";
  const customerName = text("customerName", 120);
  const customerEmail = text("customerEmail", 254).toLowerCase();
  const customerPhone = text("customerPhone", 40);
  if (!customerName || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(customerEmail) || !/^[+()\d\s.-]{7,40}$/.test(customerPhone) || customerPhone.replace(/\D/g, "").length < 7) {
    return { error: "Enter a valid name, email address, and phone number." };
  }
  const fulfillmentMethod = value.fulfillmentMethod;
  if (fulfillmentMethod !== "delivery" && fulfillmentMethod !== "local_pickup") return { error: "Choose delivery or pickup." };
  const rawAddress = value.address && typeof value.address === "object" ? value.address as Record<string, unknown> : {};
  const address: CheckoutRequest["address"] = {};
  for (const key of ["address_line_1", "address_line_2", "city", "state", "postal_code", "country"] as const) {
    const field = rawAddress[key];
    if (field !== undefined && (typeof field !== "string" || field.length > 200)) return { error: "Enter a valid delivery address." };
    address[key] = typeof field === "string" ? field.trim() : "";
  }
  if (fulfillmentMethod === "delivery" && (!address.address_line_1 || !address.city || !address.country)) return { error: "Complete your delivery address, city, and country." };
  if (!uuid.test(text("idempotencyKey", 36))) return { error: "Refresh checkout before trying again." };
  if (!Array.isArray(value.items) || value.items.length === 0 || value.items.length > 100) return { error: "Your cart must contain between 1 and 100 products." };
  const quantities = new Map<string, number>();
  for (const item of value.items) {
    if (!item || typeof item.product_id !== "string" || !uuid.test(item.product_id) || !Number.isSafeInteger(item.quantity) || item.quantity < 1 || item.quantity > 2147483647) return { error: "Your cart contains an invalid item or quantity. Please review it." };
    const quantity = (quantities.get(item.product_id) ?? 0) + item.quantity;
    if (quantity > 2147483647) return { error: "The requested quantity is too large." };
    quantities.set(item.product_id, quantity);
  }
  return { request: { customerName, customerEmail, customerPhone, address, fulfillmentMethod, idempotencyKey: text("idempotencyKey", 36), items: [...quantities].sort(([a], [b]) => a.localeCompare(b)).map(([product_id, quantity]) => ({ product_id, quantity })) } };
}

export function checkoutFailure(code?: string, message?: string): CheckoutResponse {
  if (code === "P0001" && message === "This checkout belongs to a different session.") {
    return { success: false, error: "This pending order was started with a different sign-in state. Return to that account (or sign out if you checked out as a guest), then retry it.", retrySame: true };
  }
  const known = ["Your cart is empty.", "A valid name and email are required.", "A valid phone number is required.", "A shipping address is required.", "Your cart contains an invalid item.", "A product in your cart is no longer available.", "Some items are no longer available in the requested quantity.", "Ordering is temporarily unavailable. Please check back soon."];
  if (code === "P0001" && message && known.includes(message)) return { success: false, error: message, retrySame: false };
  return { success: false, error: "We could not confirm your order. Your cart is safe. Retry this order to check its status without creating a duplicate.", retrySame: true };
}
