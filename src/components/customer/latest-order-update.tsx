import Link from "next/link";
import { orderStatusLabel } from "@/src/lib/orders/status";
import type { CustomerNotification } from "@/src/lib/notifications/record";

type LatestOrder = {
  id: string;
  confirmation_code?: string | null;
  status: string;
  fulfillment_method: string;
};

export function LatestOrderUpdate({
  order,
  notification,
}: {
  order: LatestOrder | null;
  notification: CustomerNotification | null;
}) {
  if (!order) return null;
  const title = notification?.title ?? orderStatusLabel(order.status, order.fulfillment_method);
  const code = notification?.confirmation_code ?? order.confirmation_code;
  const message = notification?.message?.split("\n")[0] ?? "Your order is being updated.";
  return (
    <section className="rounded-[28px] border border-gold/40 bg-white p-6" id="latest-order-update">
      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-gold">Latest order update</p>
      <h2 className="mt-2 text-2xl font-semibold text-forest-green">{title}</h2>
      {code ? <p className="mt-2 font-mono text-xl tracking-[0.16em] text-forest-green">{code}</p> : null}
      <p className="mt-3 text-sm leading-6 text-muted">{message}</p>
      <Link className="mt-5 inline-flex min-h-11 items-center rounded-lg bg-forest-green px-4 text-sm font-semibold text-white" href={`/account/orders/${order.id}`}>
        View Order
      </Link>
    </section>
  );
}
