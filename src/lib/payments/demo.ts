export function isDemoOrder(order: { is_demo?: boolean | null; payment_provider?: string | null; payment_status?: string | null }) {
  return order.is_demo === true || order.payment_provider === "demo" || order.payment_status === "demo";
}

export function demoPaymentLabel() {
  return "Demo / Test";
}

export function restoreInventoryAllowed(order: {
  is_demo?: boolean | null;
  payment_provider?: string | null;
  payment_status?: string | null;
  inventory_restored?: boolean | null;
}) {
  if (isDemoOrder(order) || order.inventory_restored) return false;
  if (order.payment_status === "paid" || order.payment_status === "partially_refunded") return false;
  return true;
}
