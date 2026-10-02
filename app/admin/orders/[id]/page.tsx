import { orderStatusLabel } from "@/src/lib/orders/status";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAdmin } from "@/src/lib/auth/guards";
import { CopyConfirmationButton } from "@/src/components/checkout/copy-confirmation-button";
import { AdminOrderPrintControl } from "@/src/components/admin/admin-order-print-control";
import { AdminOrderShipmentForm } from "@/src/components/admin/admin-order-shipment-form";
import { AdminOrderFulfillmentActions } from "@/src/components/admin/admin-order-fulfillment-actions";
import { getEmailProviderStatus } from "@/src/lib/email/send";
import { OrderMoneyBreakdown } from "@/src/components/orders/order-money-breakdown";
import { AdminLoadFailure } from "@/src/components/admin/admin-load-failure";
import { OrderLine } from "@/src/components/orders/order-line";
import { OrderTimeline } from "@/src/components/orders/order-timeline";
import { toOrderLineItem } from "@/src/lib/orders/line-image";

export default async function OrderDetailPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ error?: string; success?: string }> }) {
  const [{ id }, notices] = await Promise.all([params, searchParams]);
  const { supabase } = await requireAdmin();
  const [{ data: order, error }, { data: items, error: itemsError }, { data: notes }, { data: events }] = await Promise.all([
    supabase.from("orders").select("*").eq("id", id).maybeSingle(),
    supabase.from("order_items").select("product_id, product_name, product_price, quantity, image_url, products(product_images(image_url, position))").eq("order_id", id),
    supabase.from("customer_notifications").select("event_type, title, email_sent, created_at").eq("order_id", id).order("created_at", { ascending: true }),
    supabase.from("order_status_events").select("status, created_at").eq("order_id", id).order("created_at", { ascending: true }),
  ]);
  if (error || itemsError) return <AdminLoadFailure message="Unable to load order." title="Order" />;
  if (!order) notFound();
  return (
    <div className="space-y-6">
      <Link className="text-sm text-[#173f35] underline" href="/admin/orders">Back to orders</Link>
      <div>
        <p className="text-[11px] uppercase tracking-[0.2em] text-[#b8964c]">Order</p>
        <h1 className="mt-2 break-words text-3xl font-semibold text-[#173f35]">{order.order_number}</h1>
        <p className="mt-2 text-sm capitalize">{orderStatusLabel(order.status, order.fulfillment_method, order.fulfillment_provider)} &middot; {new Date(order.created_at).toLocaleString()}</p>
      </div>
      <AdminOrderPrintControl orderId={order.id} />
      <section className="rounded-2xl border border-[#b8964c]/40 bg-white p-5">
        <p className="text-[11px] uppercase tracking-[0.2em] text-[#b8964c]">Confirmation Code</p>
        <p className="mt-2 break-all font-mono text-3xl tracking-[0.18em] text-[#173f35]">{order.confirmation_code}</p>
        {order.confirmation_code ? (
          <div className="mt-4">
            <CopyConfirmationButton code={order.confirmation_code} />
          </div>
        ) : null}
        {order.fulfillment_method === "local_pickup" ? <p className="mt-3 text-sm text-[#173f35]">Verify confirmation code with customer at pickup.</p> : null}
        {order.confirmation_code ? (
          <Link className="mt-4 inline-flex min-h-11 items-center text-sm font-semibold text-[#173f35] underline underline-offset-4" href={`/admin/orders/${order.id}/email`}>
            Preview Confirmation Email
          </Link>
        ) : null}
      </section>
      {notices.error && <p className="rounded-xl bg-red-50 p-3 text-sm text-red-800">Status could not be updated. Refresh the order and choose an allowed next status.</p>}
      {notices.error === "invalid_postage" && <p className="rounded-xl bg-red-50 p-3 text-sm text-red-800">Enter a valid actual postage amount, or leave it blank.</p>}
      {notices.error === "invalid_shipment" && <p className="rounded-xl bg-red-50 p-3 text-sm text-red-800">Shipping details could not be updated for this order.</p>}
      {notices.success === "status_updated" && <p className="rounded-xl bg-[#173f35]/5 p-3 text-sm text-[#173f35]">Order status updated.</p>}
      <AdminOrderShipmentForm order={order} />
      <div className="grid gap-5 lg:grid-cols-2">
        <section className="rounded-2xl bg-white p-5">
          <h2 className="font-semibold text-[#173f35]">Customer</h2>
          <p className="mt-3">{order.customer_name}</p>
          <p className="break-all text-sm text-[#6b6b6b]">{order.customer_email}</p>
          <p className="mt-2 text-sm text-[#6b6b6b]">{order.customer_phone ?? "No phone provided"}</p>
        </section>
        <AdminOrderFulfillmentActions order={order} />
      </div>
      <section className="rounded-2xl bg-white p-5">
        <h2 className="font-semibold text-[#173f35]">Progress</h2>
        <OrderTimeline
          events={events ?? []}
          order={{
            status: order.status,
            fulfillment_method: order.fulfillment_method,
            fulfillment_provider: order.fulfillment_provider,
            created_at: order.created_at,
          }}
        />
      </section>
      <section className="rounded-2xl bg-white p-5">
        <h2 className="font-semibold text-[#173f35]">Items</h2>
        {!items?.length ? (
          <p className="mt-3 text-sm text-[#6b6b6b]">No order items recorded.</p>
        ) : (
          <div className="mt-3">
            {items.map((item, index) => (
              <OrderLine expandable item={toOrderLineItem(item)} key={`${item.product_name}-${index}`} />
            ))}
          </div>
        )}
        <div className="mt-4">
          <OrderMoneyBreakdown
            discount={order.discount_amount}
            shipping={order.shipping_cost}
            subtotal={order.subtotal}
            tax={order.tax_amount}
            total={order.total}
          />
        </div>
      </section>
      <section className="rounded-2xl bg-white p-5">
        <h2 className="font-semibold text-[#173f35]">Customer notifications</h2>
        {!notes?.length ? (
          <p className="mt-3 text-sm text-[#6b6b6b]">No in-app notifications yet. Guest orders do not receive an account notification center.</p>
        ) : (
          <ul className="mt-3 space-y-2 text-sm">
            {notes.map((note) => (
              <li key={`${note.event_type}-${note.created_at}`}>
                {note.title} — In App ✓
              </li>
            ))}
          </ul>
        )}
        <p className="mt-4 text-sm text-[#6b6b6b]">
          Email — {getEmailProviderStatus().configured ? `Configured${notes?.some((note) => note.email_sent) ? " · sent" : ""}` : "Not configured"}
        </p>
      </section>
    </div>
  );
}
