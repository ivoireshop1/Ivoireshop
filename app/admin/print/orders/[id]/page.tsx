import { notFound } from "next/navigation";
import { requireAdmin } from "@/src/lib/auth/guards";
import { isOrderPrintKind } from "@/src/lib/print/kinds";
import { OrderPrintDocument } from "@/src/components/print/order-print-document";

export default async function AdminOrderPrintPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ kind?: string }>;
}) {
  const { id } = await params;
  const { kind } = await searchParams;
  if (!isOrderPrintKind(kind)) notFound();
  const { supabase } = await requireAdmin();
  const [{ data: order, error }, { data: items, error: itemsError }] = await Promise.all([
    supabase
      .from("orders")
      .select("id, order_number, created_at, customer_name, customer_email, customer_phone, status, payment_status, fulfillment_method, fulfillment_provider, fulfillment_service, delivery_snapshot, shipping_address, subtotal, shipping_cost, discount_amount, total")
      .eq("id", id)
      .maybeSingle(),
    supabase.from("order_items").select("product_name, product_price, quantity").eq("order_id", id),
  ]);
  if (error || itemsError) throw new Error("Unable to load print document.");
  if (!order) notFound();
  return <OrderPrintDocument kind={kind} order={order} items={items ?? []} />;
}
