const ORDER_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const GUEST_TOKEN = /^[0-9a-f]{64}$/;

export function viewOrderHref(input: {
  orderId?: string | null;
  guestAccessToken?: string | null;
  accountOrder?: boolean | null;
}): string | null {
  if (input.accountOrder && input.orderId && ORDER_ID.test(input.orderId)) {
    return `/account/orders/${input.orderId}`;
  }
  if (input.guestAccessToken && GUEST_TOKEN.test(input.guestAccessToken)) {
    return `/order/confirm/${input.guestAccessToken}`;
  }
  return null;
}
