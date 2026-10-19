import { notFound } from "next/navigation";
import { requireAdmin } from "@/src/lib/auth/guards";
import { isOrderPrintKind } from "@/src/lib/print/kinds";
import { OrderPrintDocument } from "@/src/components/print/order-print-document";
import { AdminLoadFailure } from "@/src/components/admin/admin-load-failure";
import { catalogImageFromProduct } from "@/src/lib/orders/line-image";
import { STORE_SETTINGS_ID } from "@/src/lib/store/constants";

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
  const [{ data: order, error }, { data: items, error: itemsError }, { data: picks }, { data: notes }, { data: store }] = await Promise.all([
    supabase
      .from("orders")
      .select("id, order_number, created_at, customer_name, customer_email, customer_phone, status, payment_status, fulfillment_method, fulfillment_provider, fulfillment_service, shipping_mode, tracking_number, shipped_at, delivery_snapshot, shipping_address, subtotal, shipping_cost, discount_amount, tax_amount, postage_cost, total")
      .eq("id", id)
      .maybeSingle(),
    supabase.from("order_items").select("id, product_name, product_price, quantity, image_url, selling_unit, selling_method, products(product_images(image_url, position))").eq("order_id", id),
    supabase.from("order_item_picks").select("order_item_id").eq("order_id", id),
    kind === "packing-slip"
      ? supabase.from("order_internal_notes").select("body").eq("order_id", id).order("created_at", { ascending: true })
      : Promise.resolve({ data: [] as Array<{ body: string }>, error: null }),
    supabase.from("store_settings").select("packing_slip_watermark_text, packing_slip_logo_url").eq("id", STORE_SETTINGS_ID).maybeSingle(),
  ]);
  if (error || itemsError) return <AdminLoadFailure message="Unable to load print document." title="Print" />;
  if (!order) notFound();
  const picked = new Set((picks ?? []).map((row) => row.order_item_id));
  return (
    <OrderPrintDocument
      internalNotes={kind === "packing-slip" ? (notes ?? []).map((note) => note.body) : []}
      items={(items ?? []).map((item) => ({
        product_name: item.product_name,
        product_price: item.product_price,
        quantity: item.quantity,
        image_url: item.image_url || catalogImageFromProduct(item.products),
        picked: picked.has(item.id),
        selling_unit: item.selling_unit,
        selling_method: item.selling_method,
      }))}
      kind={kind}
      order={order}
      watermarkLogoUrl={kind === "packing-slip" ? store?.packing_slip_logo_url : null}
      watermarkText={kind === "packing-slip" ? store?.packing_slip_watermark_text : null}
    />
  );
}
