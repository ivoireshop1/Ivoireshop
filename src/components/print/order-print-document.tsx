import { fulfillmentDisplay } from "@/src/lib/delivery/labels";
import { formatPrintAddress, money, orderPrintTitle, type OrderPrintKind, type PrintAddress } from "@/src/lib/print/kinds";
import { PrintToolbar } from "@/src/components/print/print-toolbar";
import { pickupLocationForOrder } from "@/src/components/store/pickup-location-block";
import { formatOriginLines } from "@/src/lib/delivery/origin";
import { formatStoreDateTime } from "@/src/lib/store/timezone";
import { paymentStatusLabel } from "@/src/lib/orders/status";

type PrintItem = {
  product_name: string;
  product_price: number | string;
  quantity: number;
  image_url?: string | null;
  picked?: boolean;
};

type PrintOrder = {
  id: string;
  order_number: string;
  created_at: string;
  customer_name: string;
  customer_email: string;
  customer_phone?: string | null;
  status: string;
  payment_status: string;
  fulfillment_method: string;
  fulfillment_provider?: string | null;
  fulfillment_service?: string | null;
  delivery_snapshot?: Record<string, unknown> | null;
  shipping_address?: PrintAddress | null;
  subtotal: number | string;
  shipping_cost: number | string;
  discount_amount: number | string;
  tax_amount?: number | string;
  postage_cost?: number | string | null;
  total: number | string;
  tracking_number?: string | null;
  shipped_at?: string | null;
  shipping_mode?: string | null;
};

export function OrderPrintDocument({
  kind,
  order,
  items,
  internalNotes,
}: {
  kind: OrderPrintKind;
  order: PrintOrder;
  items: PrintItem[];
  internalNotes?: string[];
}) {
  const title = orderPrintTitle(kind);
  const pickupLocation = pickupLocationForOrder(order);
  const pickupLines = formatOriginLines(pickupLocation ?? undefined);
  const destination = pickupLines.length ? "" : formatPrintAddress(order.shipping_address);
  const fulfillment = fulfillmentDisplay(order);
  const snapshot = order.delivery_snapshot ?? {};
  const tracking = order.tracking_number || "";
  const externalId = typeof snapshot.external_id === "string" ? snapshot.external_id : "";

  return (
    <article className="print-sheet mx-auto max-w-3xl bg-white p-6 text-black sm:p-8">
      <PrintToolbar title={`Ivoire Shop · ${title}`} />
      <header className="border-b border-black pb-4">
        <p className="text-xs uppercase tracking-[0.24em]">Ivoire Shop</p>
        <h1 className="mt-2 text-3xl font-semibold">{title}</h1>
        <p className="mt-2 text-sm">Order {order.order_number}</p>
        <p className="text-sm">{formatStoreDateTime(order.created_at)}</p>
      </header>

      <section className="mt-6 grid gap-4 sm:grid-cols-2">
        <div>
          <h2 className="text-sm font-semibold uppercase tracking-[0.14em]">Customer</h2>
          <p className="mt-2">{order.customer_name}</p>
          {kind !== "packing-slip" ? <p className="break-all text-sm">{order.customer_email}</p> : null}
          {kind === "summary" && order.customer_phone ? <p className="text-sm">{order.customer_phone}</p> : null}
        </div>
        <div>
          <h2 className="text-sm font-semibold uppercase tracking-[0.14em]">Fulfillment</h2>
          <p className="mt-2">{fulfillment}</p>
          {pickupLines.length ? (
            <>
              <h3 className="mt-3 text-sm font-semibold uppercase tracking-[0.14em]">Pickup Location</h3>
              <pre className="mt-2 whitespace-pre-wrap font-sans text-sm">{pickupLines.join("\n")}</pre>
            </>
          ) : destination ? (
            <>
              <h3 className="mt-3 text-sm font-semibold uppercase tracking-[0.14em]">Shipping Address</h3>
              <pre className="mt-2 whitespace-pre-wrap font-sans text-sm">{destination}</pre>
            </>
          ) : (
            <p className="mt-2 text-sm">Store pickup</p>
          )}
        </div>
      </section>

      {kind === "summary" ? (
        <p className="mt-4 break-all text-xs text-[#333]">Internal order ID: {order.id}</p>
      ) : null}

      <table className="mt-6 w-full border-collapse text-left text-sm">
        <thead>
          <tr className="border-b border-black">
            {kind === "packing-slip" ? <th className="py-2 pr-2">✓</th> : null}
            <th className="py-2">Product</th>
            <th className="py-2 text-right">Qty</th>
            {kind !== "packing-slip" ? <th className="py-2 text-right">Unit</th> : null}
            {kind !== "packing-slip" ? <th className="py-2 text-right">Line</th> : null}
          </tr>
        </thead>
        <tbody>
          {items.map((item, index) => (
            <tr className="border-b border-black/20" key={`${item.product_name}-${index}`}>
              {kind === "packing-slip" ? <td className="py-3 pr-2">{item.picked ? "☑" : "☐"}</td> : null}
              <td className="py-3 break-words pr-3">
                <div className="flex items-center gap-2">
                  {kind === "packing-slip" && item.image_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img alt="" className="h-10 w-10 rounded object-cover" src={item.image_url} />
                  ) : null}
                  <span>{item.product_name}</span>
                </div>
              </td>
              <td className="py-3 text-right">{item.quantity}{kind === "packing-slip" && item.picked ? " picked" : ""}</td>
              {kind !== "packing-slip" ? <td className="py-3 text-right">{money(item.product_price)}</td> : null}
              {kind !== "packing-slip" ? <td className="py-3 text-right">{money(Number(item.product_price) * item.quantity)}</td> : null}
            </tr>
          ))}
        </tbody>
      </table>
      {kind === "packing-slip" ? (
        <p className="mt-2 text-xs">
          Item count: {items.reduce((sum, item) => sum + Number(item.quantity), 0)} · Carrier: {order.fulfillment_provider || "Not assigned"} · Method: {fulfillment}
          {order.tracking_number ? ` · Tracking: ${order.tracking_number}` : ""}
          {order.shipped_at ? ` · Ship date: ${formatStoreDateTime(order.shipped_at)}` : ""}
        </p>
      ) : null}

      {kind === "packing-slip" ? (
        <dl className="mt-6 ml-auto max-w-xs space-y-1 text-sm">
          <div className="flex justify-between gap-6"><dt>Shipping collected</dt><dd>{money(order.shipping_cost)}</dd></div>
          <div className="flex justify-between gap-6"><dt>Tax</dt><dd>{money(order.tax_amount)}</dd></div>
          <div className="flex justify-between gap-6 font-semibold"><dt>Total</dt><dd>{money(order.total)}</dd></div>
        </dl>
      ) : null}

      {kind !== "packing-slip" ? (
        <dl className="mt-6 ml-auto max-w-xs space-y-1 text-sm">
          <div className="flex justify-between gap-6"><dt>Subtotal</dt><dd>{money(order.subtotal)}</dd></div>
          {Number(order.discount_amount) > 0 ? <div className="flex justify-between gap-6"><dt>Discount</dt><dd>{money(order.discount_amount)}</dd></div> : null}
          <div className="flex justify-between gap-6"><dt>Delivery / shipping</dt><dd>{money(order.shipping_cost)}</dd></div>
          <div className="flex justify-between gap-6"><dt>Tax</dt><dd>{money(order.tax_amount)}</dd></div>
          <div className="flex justify-between gap-6 font-semibold"><dt>Total</dt><dd>{money(order.total)}</dd></div>
        </dl>
      ) : null}

      {kind === "receipt" || kind === "summary" ? (
        <div className="mt-4 space-y-1 text-sm">
          <p>Payment: {paymentStatusLabel(order.payment_status)}</p>
          <p>Payment method: Card</p>
          <p>Fulfillment: {fulfillment}</p>
          {order.fulfillment_provider ? <p>Carrier: {String(order.fulfillment_provider).toUpperCase()}</p> : null}
          {order.tracking_number ? <p className="break-all">Tracking: {order.tracking_number}</p> : null}
          {order.shipped_at ? <p>Ship date: {formatStoreDateTime(order.shipped_at)}</p> : null}
          {order.postage_cost != null ? <p>Actual postage: {money(order.postage_cost)}</p> : null}
        </div>
      ) : null}

      {kind === "delivery" ? (
        <section className="mt-6 border-t border-black/20 pt-4 text-sm">
          <h2 className="font-semibold">Carrier / courier operations</h2>
          <p className="mt-2">Provider: {order.fulfillment_provider || "Not assigned"}</p>
          <p>Mode: {order.shipping_mode === "api" ? "API" : order.fulfillment_provider ? "Manual" : "—"}</p>
          {order.fulfillment_service ? <p>Service: {order.fulfillment_service}</p> : null}
          {order.customer_phone ? <p>Contact: {order.customer_phone}</p> : null}
          {externalId ? <p className="break-all">External reference: {externalId}</p> : null}
          {order.tracking_number ? <p className="break-all">Tracking: {order.tracking_number}</p> : tracking ? <p className="break-all">Tracking: {tracking}</p> : <p className="mt-2 text-xs">Tracking appears here after admin enters the carrier tracking number.</p>}
          {order.postage_cost != null ? <p>Actual postage: {money(order.postage_cost)}</p> : null}
          <p>Shipping collected: {money(order.shipping_cost)}</p>
          {order.shipped_at ? <p>Ship date: {formatStoreDateTime(order.shipped_at)}</p> : null}
        </section>
      ) : null}

      {kind === "packing-slip" && internalNotes?.length ? (
        <section className="mt-6 border-t border-black/20 pt-4 text-sm">
          <h2 className="font-semibold">Internal packing notes</h2>
          {internalNotes.map((note) => <p className="mt-2 whitespace-pre-wrap" key={note}>{note}</p>)}
        </section>
      ) : null}
    </article>
  );
}
