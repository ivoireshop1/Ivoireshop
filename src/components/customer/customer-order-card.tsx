import Link from "next/link";
import Image from "next/image";
import { ReorderButton } from "@/src/components/customer/reorder-button";
import { fulfillmentLabel } from "@/src/lib/fulfillment/fulfillment";
import { orderStatusLabel, paymentStatusLabel } from "@/src/lib/orders/status";
import { formatStoreDate } from "@/src/lib/store/timezone";
import { isNextImageSrc } from "@/src/lib/catalog/image-url";
import { isCarrierOrder, officialTrackLabel, trackingUrl } from "@/src/lib/delivery/tracking";

export type CustomerOrderSummary = {
  id: string;
  order_number: string;
  confirmation_code?: string | null;
  status: string;
  payment_status: string;
  total: number | string;
  fulfillment_method: string;
  fulfillment_provider?: string | null;
  tracking_number?: string | null;
  created_at: string;
  order_items: { product_name: string; quantity: number; image_url?: string | null }[];
};

export function CustomerOrderCard({ order }: { order: CustomerOrderSummary }) {
  const itemCount = order.order_items.reduce((count, item) => count + item.quantity, 0);
  const preview = order.order_items.slice(0, 3).map((item) => item.product_name).join(", ");
  const trackHref = isCarrierOrder(order.fulfillment_provider) && order.tracking_number
    ? trackingUrl(order.fulfillment_provider ?? "", order.tracking_number)
    : "";

  return (
    <article className="rounded-[24px] border border-forest-green/10 bg-[#f7f3ee] p-5 shadow-[0_12px_24px_rgba(23,63,53,0.05)]" id={`order-${order.id}`}>
      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-gold">Order</p>
      <div className="mt-2 flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xl font-semibold text-forest-green">{order.order_number}</p>
          {order.confirmation_code ? (
            <p className="mt-1 font-mono text-sm tracking-[0.14em] text-forest-green">{order.confirmation_code}</p>
          ) : null}
          <p className="mt-1 text-sm text-muted">
            {formatStoreDate(order.created_at)} · {itemCount} item{itemCount === 1 ? "" : "s"}
          </p>
        </div>
        <div className="text-right">
          <p className="font-semibold text-forest-green">${Number(order.total).toFixed(2)}</p>
          <p className="mt-1 text-xs font-semibold uppercase tracking-wide text-gold">
            {orderStatusLabel(order.status, order.fulfillment_method, order.fulfillment_provider)} · {fulfillmentLabel(order.fulfillment_method)}
          </p>
        </div>
      </div>
      <p className="mt-2 text-sm text-muted">{paymentStatusLabel(order.payment_status)}</p>
      {preview ? <p className="mt-3 text-sm text-muted">{preview}</p> : null}
      {order.order_items.length ? (
        <div className="mt-3 flex gap-2">
          {order.order_items.slice(0, 4).map((item, index) => (
            <span className="relative h-12 w-12 overflow-hidden rounded-lg bg-[#eadfce]" key={`${item.product_name}-${index}`}>
              {item.image_url && isNextImageSrc(item.image_url) ? (
                <Image alt="" className="object-cover" fill sizes="48px" src={item.image_url} unoptimized />
              ) : (
                <span className="flex h-full items-center justify-center text-[9px] font-semibold uppercase tracking-wide text-forest-green">Ivoire</span>
              )}
            </span>
          ))}
        </div>
      ) : null}
      <div className="mt-4 flex flex-wrap items-center gap-3">
        <Link className="rounded-lg border border-forest-green/20 px-3 py-2 text-sm font-semibold text-forest-green" href={`/account/orders/${order.id}`}>
          View order
        </Link>
        {trackHref ? (
          <a className="rounded-lg bg-forest-green px-3 py-2 text-sm font-semibold text-white" href={trackHref} rel="noreferrer" target="_blank">
            {officialTrackLabel(order.fulfillment_provider)}
          </a>
        ) : null}
        <ReorderButton orderId={order.id} />
      </div>
    </article>
  );
}
