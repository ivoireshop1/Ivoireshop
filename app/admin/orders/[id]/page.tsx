import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAdmin } from "@/src/lib/auth/guards";
import { CopyConfirmationButton } from "@/src/components/checkout/copy-confirmation-button";
import { AdminOrderShipmentForm } from "@/src/components/admin/admin-order-shipment-form";
import { AdminOrderFulfillmentActions } from "@/src/components/admin/admin-order-fulfillment-actions";
import { AdminOrderControlHeader } from "@/src/components/admin/admin-order-control-header";
import { AdminFulfillmentChecklist } from "@/src/components/admin/admin-fulfillment-checklist";
import { AdminOrderPicking } from "@/src/components/admin/admin-order-picking";
import { AdminOrderInternalNotes } from "@/src/components/admin/admin-order-internal-notes";
import { AdminOrderPaymentPanel } from "@/src/components/admin/admin-order-payment-panel";
import { AdminOrderFulfillmentPanel } from "@/src/components/admin/admin-order-fulfillment-panel";
import { AdminOrderPrintActions } from "@/src/components/admin/admin-order-print-actions";
import { getEmailProviderStatus } from "@/src/lib/email/send";
import { AdminLoadFailure } from "@/src/components/admin/admin-load-failure";
import { LiveOrderTimeline } from "@/src/components/orders/live-order-timeline";
import { catalogImageFromProduct } from "@/src/lib/orders/line-image";
import { getStripeConfig } from "@/src/lib/payments/stripe-config";
import { isCarrierFulfillment } from "@/src/lib/orders/timeline";

export default async function OrderDetailPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ error?: string; success?: string }> }) {
  const [{ id }, notices] = await Promise.all([params, searchParams]);
  const { supabase } = await requireAdmin();
  const [{ data: order, error }, { data: items, error: itemsError }, { data: customerNotes }, { data: events }, { data: picks }, { data: internalNotes }] = await Promise.all([
    supabase.from("orders").select("*").eq("id", id).maybeSingle(),
    supabase.from("order_items").select("id, product_id, product_name, product_price, quantity, image_url, products(product_images(image_url, position))").eq("order_id", id),
    supabase.from("customer_notifications").select("event_type, title, email_sent, created_at").eq("order_id", id).order("created_at", { ascending: true }),
    supabase.from("order_status_events").select("status, created_at").eq("order_id", id).order("created_at", { ascending: true }),
    supabase.from("order_item_picks").select("order_item_id").eq("order_id", id),
    supabase.from("order_internal_notes").select("id, body, created_at, created_by").eq("order_id", id).order("created_at", { ascending: false }),
  ]);
  if (error || itemsError) return <AdminLoadFailure message="Unable to load order." title="Order" />;
  if (!order) notFound();
  const authorIds = [...new Set((internalNotes ?? []).map((note) => note.created_by).filter(Boolean))] as string[];
  const { data: authors } = authorIds.length
    ? await supabase.from("profiles").select("id, full_name").in("id", authorIds)
    : { data: [] as Array<{ id: string; full_name: string | null }> };
  const authorNames = new Map((authors ?? []).map((row) => [row.id, row.full_name]));
  const picked = new Set((picks ?? []).map((row) => row.order_item_id));
  const carrier = isCarrierFulfillment(order.fulfillment_provider);
  const customerNotified = (customerNotes ?? []).some((note) => note.event_type === "ready_for_pickup" || note.event_type === "ready_for_delivery" || note.event_type === "shipped");
  return (
    <div className="min-w-0 space-y-6">
      <Link className="text-sm text-[#173f35] underline" href="/admin/orders">Back to orders</Link>
      <AdminOrderControlHeader order={order} />
      {notices.error && notices.error !== "invalid_postage" && notices.error !== "invalid_shipment" ? <p className="rounded-xl bg-red-50 p-3 text-sm text-red-800">Status could not be updated. Refresh the order and choose an allowed next status.</p> : null}
      {notices.error === "invalid_postage" ? <p className="rounded-xl bg-red-50 p-3 text-sm text-red-800">Enter a valid actual postage amount, or leave it blank.</p> : null}
      {notices.error === "invalid_shipment" ? <p className="rounded-xl bg-red-50 p-3 text-sm text-red-800">Shipping details could not be updated for this order.</p> : null}
      <AdminOrderPrintActions fulfillmentMethod={order.fulfillment_method} fulfillmentProvider={order.fulfillment_provider} orderId={order.id} />
      <section className="rounded-2xl border border-[#b8964c]/40 bg-white p-5">
        <p className="text-[11px] uppercase tracking-[0.2em] text-[#b8964c]">Confirmation Code</p>
        <p className="mt-2 break-all font-mono text-3xl tracking-[0.18em] text-[#173f35]">{order.confirmation_code}</p>
        {order.confirmation_code ? <div className="mt-4"><CopyConfirmationButton code={order.confirmation_code} /></div> : null}
        {order.fulfillment_method === "local_pickup" ? <p className="mt-3 text-sm text-[#173f35]">Verify confirmation code with customer at pickup.</p> : null}
      </section>
      <div className="grid min-w-0 gap-5 lg:grid-cols-2">
        <section className="rounded-2xl bg-white p-5">
          <h2 className="font-semibold text-[#173f35]">Customer</h2>
          <p className="mt-3">{order.customer_name}</p>
          <p className="break-all text-sm text-[#6b6b6b]">{order.customer_email}</p>
          <p className="mt-2 text-sm text-[#6b6b6b]">{order.customer_phone ?? "No phone provided"}</p>
          <div className="mt-4 flex flex-wrap gap-2">
            {order.customer_phone ? (
              <a className="inline-flex min-h-11 items-center rounded-xl bg-[#173f35] px-4 text-sm font-semibold text-white" href={`tel:${String(order.customer_phone).replace(/[^\d+]/g, "")}`}>Call</a>
            ) : null}
            {order.customer_email ? (
              <a className="inline-flex min-h-11 items-center rounded-xl border border-[#173f35]/20 px-4 text-sm font-semibold text-[#173f35]" href={`mailto:${order.customer_email}`}>Email</a>
            ) : null}
          </div>
        </section>
        <AdminFulfillmentChecklist
          customerNotified={customerNotified}
          order={{
            status: order.status,
            payment_status: order.payment_status,
            fulfillment_method: order.fulfillment_method,
            fulfillment_provider: order.fulfillment_provider,
            tracking_number: order.tracking_number,
          }}
        />
      </div>
      {carrier ? <AdminOrderShipmentForm order={order} /> : null}
      <div className="grid min-w-0 gap-5 lg:grid-cols-2">
        <AdminOrderFulfillmentPanel events={events ?? []} order={order} />
        <AdminOrderFulfillmentActions order={order} />
      </div>
      <AdminOrderPaymentPanel order={order} stripeMode={getStripeConfig().mode} />
      <AdminOrderPicking
        items={(items ?? []).map((item) => ({
          id: item.id,
          product_name: item.product_name,
          product_price: item.product_price,
          quantity: item.quantity,
          image_url: item.image_url,
          catalog_image_url: catalogImageFromProduct(item.products),
          picked: picked.has(item.id),
        }))}
        orderId={order.id}
      />
      <AdminOrderInternalNotes
        notes={(internalNotes ?? []).map((note) => ({
          ...note,
          author_name: note.created_by ? authorNames.get(note.created_by) : "Admin",
        }))}
        orderId={order.id}
      />
      <section className="rounded-2xl bg-white p-5">
        <h2 className="font-semibold text-[#173f35]">Progress</h2>
        <LiveOrderTimeline
          events={events ?? []}
          order={{
            status: order.status,
            fulfillment_method: order.fulfillment_method,
            fulfillment_provider: order.fulfillment_provider,
            created_at: order.created_at,
          }}
          orderId={order.id}
        />
      </section>
      <section className="rounded-2xl bg-white p-5">
        <h2 className="font-semibold text-[#173f35]">Customer notifications</h2>
        {!customerNotes?.length ? (
          <p className="mt-3 text-sm text-[#6b6b6b]">No in-app notifications yet. Guest orders do not receive an account notification center.</p>
        ) : (
          <ul className="mt-3 space-y-2 text-sm">
            {customerNotes.map((note) => (
              <li key={`${note.event_type}-${note.created_at}`}>{note.title} — In App ✓</li>
            ))}
          </ul>
        )}
        <p className="mt-4 text-sm text-[#6b6b6b]">
          Email — {getEmailProviderStatus().configured ? `Configured${customerNotes?.some((note) => note.email_sent) ? " · sent" : ""}` : "Not configured"}
        </p>
      </section>
    </div>
  );
}
