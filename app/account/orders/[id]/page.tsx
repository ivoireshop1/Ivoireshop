import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { getCustomerOrder } from "@/src/lib/customer/orders";
import { orderStatusLabel } from "@/src/lib/orders/status";
import { SmartBackButton } from "@/src/components/navigation/smart-back-button";
import { ReorderButton } from "@/src/components/customer/reorder-button";
import { fulfillmentLabel } from "@/src/lib/fulfillment/fulfillment";

export default async function CustomerOrderPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const result = await getCustomerOrder(id);
  if (result.kind === "unauthenticated") redirect("/login?next=" + encodeURIComponent("/account/orders/" + id));
  if (result.kind === "missing") notFound();
  const { order } = result;
  const items = order.order_items;

  return (
    <main className="mx-auto w-full max-w-3xl px-6 py-12">
      <SmartBackButton fallbackHref="/account" fallbackLabel="Back to account" />
      <p className="mt-8 text-xs font-semibold uppercase tracking-[0.2em] text-gold">Order</p>
      <h1 className="mt-2 text-4xl font-semibold text-forest-green">{order.order_number}</h1>
      <p className="mt-3 text-muted">
        {new Date(order.created_at).toLocaleDateString()} · {orderStatusLabel(order.status, order.fulfillment_method)} · {fulfillmentLabel(order.fulfillment_method)}
      </p>

      <p className="mt-3 capitalize text-muted">Payment: {order.payment_status}</p>
      <section className="mt-8 rounded-2xl border border-black/10 bg-white p-6">
        <h2 className="font-semibold text-forest-green">Items</h2>
        <div className="mt-4 space-y-3">
          {!items?.length && <p className="text-sm text-muted">No items recorded for this order.</p>}
          {(items ?? []).map((item, index) => (
            <div className="flex justify-between gap-4 text-sm" key={`${item.product_name}-${index}`}>
              <span className="text-muted">{item.product_name} × {item.quantity}</span>
              <span className="font-semibold text-forest-green">${(Number(item.product_price) * item.quantity).toFixed(2)}</span>
            </div>
          ))}
        </div>
        <dl className="mt-5 space-y-2 text-sm"><div className="flex justify-between"><dt>Subtotal</dt><dd>${Number(order.subtotal).toFixed(2)}</dd></div><div className="flex justify-between"><dt>Shipping</dt><dd>${Number(order.shipping_cost).toFixed(2)}</dd></div><div className="flex justify-between"><dt>Discount</dt><dd>${Number(order.discount_amount).toFixed(2)}</dd></div></dl>
        {order.fulfillment_method === "delivery" && <div className="mt-6"><h2 className="font-semibold text-forest-green">Delivery address</h2><address className="mt-2 whitespace-pre-line not-italic text-muted">{[order.shipping_address?.address_line_1, order.shipping_address?.address_line_2, order.shipping_address?.city, order.shipping_address?.state, order.shipping_address?.postal_code, order.shipping_address?.country].filter(Boolean).join("\n")}</address></div>}
        <p className="mt-5 text-right text-lg font-semibold text-forest-green">Total ${Number(order.total).toFixed(2)}</p>
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
