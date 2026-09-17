import Link from "next/link";
import { ReorderButton } from "@/src/components/customer/reorder-button";
import { fulfillmentLabel } from "@/src/lib/fulfillment/fulfillment";

export type CustomerOrderSummary = {
  id: string;
  order_number: string;
  status: string;
  total: number | string;
  fulfillment_method: string;
  created_at: string;
  order_items: { product_name: string; quantity: number }[];
};

export function CustomerOrderCard({ order }: { order: CustomerOrderSummary }) {
  const itemCount = order.order_items.reduce((count, item) => count + item.quantity, 0);
  const preview = order.order_items.slice(0, 3).map((item) => item.product_name).join(", ");

  return (
    <article className="rounded-[24px] border border-forest-green/10 bg-[#f7f3ee] p-5 shadow-[0_12px_24px_rgba(23,63,53,0.05)]" id={`order-${order.id}`}>
      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-gold">Recent order</p>
      <div className="mt-2 flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xl font-semibold text-forest-green">{order.order_number}</p>
          <p className="mt-1 text-sm text-muted">
            {new Date(order.created_at).toLocaleDateString()} · {itemCount} item{itemCount === 1 ? "" : "s"}
          </p>
        </div>
        <div className="text-right">
          <p className="font-semibold text-forest-green">${Number(order.total).toFixed(2)}</p>
          <p className="mt-1 text-xs font-semibold uppercase tracking-wide text-gold">
            {order.status.replaceAll("_", " ")} · {fulfillmentLabel(order.fulfillment_method)}
          </p>
        </div>
      </div>
      {preview ? <p className="mt-3 text-sm text-muted">{preview}</p> : null}
      <div className="mt-4 flex flex-wrap items-center gap-3">
        <Link className="rounded-lg border border-forest-green/20 px-3 py-2 text-sm font-semibold text-forest-green" href={`/account/orders/${order.id}`}>
          View order
        </Link>
        <ReorderButton orderId={order.id} />
      </div>
    </article>
  );
}
