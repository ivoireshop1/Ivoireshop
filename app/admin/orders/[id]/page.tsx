import { nextOrderStatuses, orderStatusLabel, paymentProviderLabel, paymentStatusLabel } from "@/src/lib/orders/status";
import Link from "next/link";
import { notFound } from "next/navigation";
import { updateOrderStatus } from "@/src/lib/catalog/actions";
import { requireAdmin } from "@/src/lib/auth/guards";
import { CopyConfirmationButton } from "@/src/components/checkout/copy-confirmation-button";
import { AdminOrderPrintControl } from "@/src/components/admin/admin-order-print-control";
import { AdminOrderShipmentForm } from "@/src/components/admin/admin-order-shipment-form";
import { getEmailProviderStatus } from "@/src/lib/email/send";
import { fulfillmentDisplay } from "@/src/lib/delivery/labels";
import { OrderMoneyBreakdown } from "@/src/components/orders/order-money-breakdown";

export default async function OrderDetailPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ error?: string; success?: string }> }) {
  const [{ id }, notices] = await Promise.all([params, searchParams]);
  const { supabase } = await requireAdmin();
  const [{ data: order, error }, { data: items, error: itemsError }, { data: notes }] = await Promise.all([
    supabase.from("orders").select("*").eq("id", id).maybeSingle(),
    supabase.from("order_items").select("product_name, product_price, quantity").eq("order_id", id),
    supabase.from("customer_notifications").select("event_type, title, email_sent, created_at").eq("order_id", id).order("created_at", { ascending: true }),
  ]);
  if (error || itemsError) throw new Error("Unable to load order.");
  if (!order) notFound();
  const nextStatuses = nextOrderStatuses(order.status, order.fulfillment_method);
  return (
    <div className="space-y-6">
      <Link className="text-sm text-[#173f35] underline" href="/admin/orders">Back to orders</Link>
      <div>
        <p className="text-[11px] uppercase tracking-[0.2em] text-[#b8964c]">Order</p>
        <h1 className="mt-2 break-words text-3xl font-semibold text-[#173f35]">{order.order_number}</h1>
        <p className="mt-2 text-sm capitalize">{orderStatusLabel(order.status, order.fulfillment_method)} &middot; {new Date(order.created_at).toLocaleString()}</p>
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
      {notices.success === "shipment_updated" && <p className="rounded-xl bg-[#173f35]/5 p-3 text-sm text-[#173f35]">Shipping details saved.</p>}
      {notices.success === "status_updated" && <p className="rounded-xl bg-[#173f35]/5 p-3 text-sm text-[#173f35]">Order status updated.</p>}
      <AdminOrderShipmentForm order={order} />
      <div className="grid gap-5 lg:grid-cols-2">
        <section className="rounded-2xl bg-white p-5">
          <h2 className="font-semibold text-[#173f35]">Customer</h2>
          <p className="mt-3">{order.customer_name}</p>
          <p className="break-all text-sm text-[#6b6b6b]">{order.customer_email}</p>
          <p className="mt-2 text-sm text-[#6b6b6b]">{order.customer_phone ?? "No phone provided"}</p>
        </section>
        <form action={updateOrderStatus} className="rounded-2xl bg-white p-5">
          <input name="id" type="hidden" value={order.id} />
          <input name="expected_status" type="hidden" value={order.status} />
          <h2 className="font-semibold text-[#173f35]">Fulfillment</h2>
          <p className="mt-3 text-sm">{fulfillmentDisplay(order)}</p>
          {order.fulfillment_service && order.fulfillment_provider ? (
            <p className="mt-2 break-words text-sm text-[#6b6b6b]">Service snapshot: {order.fulfillment_service}</p>
          ) : null}
          {order.fulfillment_method === "delivery" && (
            <address className="mt-3 whitespace-pre-line text-sm not-italic text-[#6b6b6b]">
              {[order.shipping_address?.address_line_1, order.shipping_address?.address_line_2, order.shipping_address?.city, order.shipping_address?.state, order.shipping_address?.postal_code, order.shipping_address?.country].filter(Boolean).join("\n")}
            </address>
          )}
          <p className="mt-4 text-sm">Payment: {paymentStatusLabel(order.payment_status, order.payment_provider)}</p>
          <p className="mt-1 text-sm text-[#6b6b6b]">Provider: {paymentProviderLabel(order.payment_provider, order.payment_method)}</p>
          {order.provider_payment_id ? <p className="mt-2 break-all text-xs text-[#6b6b6b]">Provider payment ID: {order.provider_payment_id}</p> : null}
          {order.provider_order_id ? <p className="mt-1 break-all text-xs text-[#6b6b6b]">Provider order ID: {order.provider_order_id}</p> : null}
          <label className="mt-4 block text-sm" htmlFor="next-status">
            Next order status
            <select className="mt-3 w-full rounded-xl border border-[#173f35]/15 px-3 py-2" defaultValue="" disabled={nextStatuses.length === 0} id="next-status" name="status">
              <option value="" disabled>Choose next status</option>
              {nextStatuses.map((value) => (
                <option key={value} value={value}>{orderStatusLabel(value, order.fulfillment_method)}</option>
              ))}
            </select>
          </label>
          <p className="mt-2 text-sm text-muted">Cancellation does not issue a refund or automatically restock inventory.</p>
          <button className="mt-4 min-h-11 rounded-xl bg-[#173f35] px-4 py-2 text-sm text-white disabled:cursor-not-allowed disabled:opacity-50" disabled={nextStatuses.length === 0} type="submit">
            Update status
          </button>
        </form>
      </div>
      <section className="rounded-2xl bg-white p-5">
        <h2 className="font-semibold text-[#173f35]">Items</h2>
        {!items?.length ? (
          <p className="mt-3 text-sm text-[#6b6b6b]">No order items recorded.</p>
        ) : (
          <div className="mt-3 space-y-2">
            {items.map((item, index) => (
              <div className="flex justify-between gap-4 border-b border-[#173f35]/10 py-3" key={`${item.product_name}-${index}`}>
                <span>{item.product_name} × {item.quantity}</span>
                <span>${(Number(item.product_price) * item.quantity).toFixed(2)}</span>
              </div>
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
