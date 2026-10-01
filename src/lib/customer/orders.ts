import { createClient } from "@/src/lib/supabase/server";

export async function getCustomerOrder(id: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { kind: "unauthenticated" as const };
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) return { kind: "missing" as const };
  // Explicit ownership also protects the customer-facing view for admin accounts.
  // RLS remains the database boundary; never use a service-role client here.
  const { data: order, error } = await supabase.from("orders")
    .select("id, order_number, confirmation_code, status, payment_status, payment_method, payment_provider, fulfillment_method, fulfillment_provider, fulfillment_service, tracking_number, shipped_at, subtotal, shipping_cost, discount_amount, tax_amount, total, created_at, shipping_address, delivery_snapshot, order_items(product_name, product_price, quantity)")
    .eq("id", id).eq("user_id", user.id).maybeSingle();
  if (error) throw new Error("Unable to load your order. Please try again.");
  return order ? { kind: "found" as const, order } : { kind: "missing" as const };
}
