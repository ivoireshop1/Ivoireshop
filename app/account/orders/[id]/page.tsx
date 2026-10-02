import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { getCustomerOrder } from "@/src/lib/customer/orders";
import { SmartBackButton } from "@/src/components/navigation/smart-back-button";
import { ReorderButton } from "@/src/components/customer/reorder-button";
import { CopyConfirmationButton } from "@/src/components/checkout/copy-confirmation-button";
import { markOrderNotificationsSeen } from "@/src/lib/notifications/queries";
import { PickupLocationBlock, pickupLocationForOrder } from "@/src/components/store/pickup-location-block";
import { OrderMoneyBreakdown } from "@/src/components/orders/order-money-breakdown";
import { ShipmentTrackingPanel } from "@/src/components/orders/shipment-tracking-panel";
import { OrderLine } from "@/src/components/orders/order-line";
import { LiveOrderTimeline } from "@/src/components/orders/live-order-timeline";
import { LiveOrderStatusLine } from "@/src/components/orders/live-order-status-line";
import { toOrderLineItem } from "@/src/lib/orders/line-image";

export default async function CustomerOrderPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const result = await getCustomerOrder(id);
  if (result.kind === "unauthenticated") redirect("/login?next=" + encodeURIComponent("/account/orders/" + id));
  if (result.kind === "missing") notFound();
  const { order } = result;
  await markOrderNotificationsSeen(order.id);
  const items = order.order_items;

  return (
    <main className="mx-auto w-full max-w-3xl px-6 py-12">
      <SmartBackButton fallbackHref="/account" fallbackLabel="Back to account" />
      <p className="mt-8 text-xs font-semibold uppercase tracking-[0.2em] text-gold">Order</p>
      <h1 className="mt-2 text-4xl font-semibold text-forest-green">{order.order_number}</h1>
      {order.confirmation_code ? (
        <section className="mt-6 rounded-[24px] border border-gold/40 bg-white px-5 py-6 text-center">
          <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-gold">Your confirmation code</p>
          <p className="mt-3 break-all font-mono text-4xl font-semibold tracking-[0.18em] text-forest-green">{order.confirmation_code}</p>
          <div className="mt-4 flex justify-center">
            <CopyConfirmationButton code={order.confirmation_code} />
          </div>
          {order.fulfillment_method === "local_pickup" ? (
            <p className="mt-4 text-sm leading-6 text-muted">Keep this code handy. We&apos;ll use it to verify your order at pickup.</p>
          ) : null}
        </section>
      ) : null}
      <LiveOrderStatusLine
        createdAt={order.created_at}
        fulfillmentMethod={order.fulfillment_method}
        fulfillmentProvider={order.fulfillment_provider}
        orderId={order.id}
        paymentMethod={order.payment_method}
        paymentProvider={order.payment_provider}
        paymentStatus={order.payment_status}
        status={order.status}
      />
      <section className="mt-8 rounded-2xl border border-black/10 bg-white p-6">
        <h2 className="font-semibold text-forest-green">Order progress</h2>
        <LiveOrderTimeline
          events={order.order_status_events ?? []}
          order={{
            status: order.status,
            fulfillment_method: order.fulfillment_method,
            fulfillment_provider: order.fulfillment_provider,
            created_at: order.created_at,
          }}
          orderId={order.id}
        />
      </section>
      <section className="mt-8 rounded-2xl border border-black/10 bg-white p-6">
        <h2 className="font-semibold text-forest-green">Items</h2>
        <div className="mt-4">
          {!items?.length && <p className="text-sm text-muted">No items recorded for this order.</p>}
          {(items ?? []).map((item, index) => (
            <OrderLine item={toOrderLineItem(item)} key={`${item.product_name}-${index}`} />
          ))}
        </div>
        <dl className="mt-5">
          <OrderMoneyBreakdown
            discount={order.discount_amount}
            shipping={order.shipping_cost}
            subtotal={order.subtotal}
            tax={order.tax_amount}
            total={order.total}
          />
        </dl>
        <ShipmentTrackingPanel order={order} />
        {order.fulfillment_method === "local_pickup" ? (
          <div className="mt-6">
            <p className="font-semibold text-forest-green">Fulfillment</p>
            <p className="mt-1 text-sm text-muted">Store Pickup</p>
            <PickupLocationBlock className="mt-3" location={pickupLocationForOrder(order)} />
          </div>
        ) : null}
        {order.fulfillment_method === "delivery" && <div className="mt-6"><h2 className="font-semibold text-forest-green">Delivery address</h2><address className="mt-2 whitespace-pre-line not-italic text-muted">{[order.shipping_address?.address_line_1, order.shipping_address?.address_line_2, order.shipping_address?.city, order.shipping_address?.state, order.shipping_address?.postal_code, order.shipping_address?.country].filter(Boolean).join("\n")}</address></div>}
        <div className="mt-5 flex flex-wrap items-center gap-3">
          <ReorderButton orderId={order.id} />
          <Link className="text-sm font-semibold text-forest-green underline underline-offset-4" href="/shop">
            Continue shopping
          </Link>
        </div>
      </section>
    </main>
  );
}
