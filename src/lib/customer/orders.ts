import { createClient } from "@/src/lib/supabase/server";

export async function getCustomerOrder(id: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { kind: "unauthenticated" as const };
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) return { kind: "missing" as const };
  // Explicit ownership also protects the customer-facing view for admin accounts.
  // RLS remains the database boundary; never use a service-role client here.
  const { data: order, error } = await supabase.from("orders")
    .select("id, order_number, status, payment_status, fulfillment_method, subtotal, shipping_cost, discount_amount, total, created_at, shipping_address, order_items(product_name, product_price, quantity)")
    .eq("id", id).eq("user_id", user.id).maybeSingle();
  if (error) throw new Error("Unable to load your order. Please try again.");
  return order ? { kind: "found" as const, order } : { kind: "missing" as const };
}
