/** Guest order list buckets — completed statuses move to Past Orders (DB rows stay). */

const PAST_STATUSES = new Set(["delivered", "cancelled"]);

export function isGuestOrderPast(status: string): boolean {
  return PAST_STATUSES.has(String(status || "").toLowerCase());
}

export function isGuestOrderActive(status: string): boolean {
  return !isGuestOrderPast(status);
}

export type GuestOrderListItem = {
  token: string;
  orderId: string;
  orderNumber: string;
  confirmationCode: string;
  status: string;
  paymentStatus: string;
  paymentProvider?: string | null;
  paymentMethod?: string | null;
  fulfillmentMethod: string;
  fulfillmentProvider?: string | null;
  fulfillmentService?: string | null;
  trackingNumber?: string | null;
  shippedAt?: string | null;
  total: number;
  subtotal: number;
  shippingCost: number;
  taxAmount: number;
  createdAt: string;
  items: Array<{
    product_name: string;
    product_price: number;
    quantity: number;
    image_url?: string | null;
  }>;
};

export function partitionGuestOrders(orders: GuestOrderListItem[]) {
  const active: GuestOrderListItem[] = [];
  const past: GuestOrderListItem[] = [];
  for (const order of orders) {
    if (isGuestOrderPast(order.status)) past.push(order);
    else active.push(order);
  }
  return { active, past };
}
