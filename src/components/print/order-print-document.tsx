import { fulfillmentDisplay } from "@/src/lib/delivery/labels";
import { formatPrintAddress, money, orderPrintTitle, type OrderPrintKind, type PrintAddress } from "@/src/lib/print/kinds";
import { PrintToolbar } from "@/src/components/print/print-toolbar";

type PrintItem = {
  product_name: string;
  product_price: number | string;
  quantity: number;
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
  total: number | string;
};

export function OrderPrintDocument({
  kind,
  order,
  items,
}: {
  kind: OrderPrintKind;
  order: PrintOrder;
  items: PrintItem[];
}) {
  const title = orderPrintTitle(kind);
  const destination = formatPrintAddress(order.shipping_address);
  const fulfillment = fulfillmentDisplay(order);
  const snapshot = order.delivery_snapshot ?? {};
  const tracking = typeof snapshot.tracking_url === "string" ? snapshot.tracking_url : "";
  const externalId = typeof snapshot.external_id === "string" ? snapshot.external_id : "";

  return (
    <article className="print-sheet mx-auto max-w-3xl bg-white p-6 text-black sm:p-8">
      <PrintToolbar title={`Ivoire Shop · ${title}`} />
      <header className="border-b border-black pb-4">
        <p className="text-xs uppercase tracking-[0.24em]">Ivoire Shop</p>
        <h1 className="mt-2 text-3xl font-semibold">{title}</h1>
        <p className="mt-2 text-sm">Order {order.order_number}</p>
        <p className="text-sm">{new Date(order.created_at).toLocaleString()}</p>
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
          {destination ? <pre className="mt-2 whitespace-pre-wrap font-sans text-sm">{destination}</pre> : <p className="mt-2 text-sm">Store pickup</p>}
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
              {kind === "packing-slip" ? <td className="py-3 pr-2">☐</td> : null}
              <td className="py-3 break-words pr-3">{item.product_name}</td>
              <td className="py-3 text-right">{item.quantity}</td>
              {kind !== "packing-slip" ? <td className="py-3 text-right">{money(item.product_price)}</td> : null}
              {kind !== "packing-slip" ? <td className="py-3 text-right">{money(Number(item.product_price) * item.quantity)}</td> : null}
            </tr>
          ))}
        </tbody>
      </table>
      {kind === "packing-slip" ? <p className="mt-2 text-xs">Item count: {items.reduce((sum, item) => sum + Number(item.quantity), 0)}</p> : null}

      {kind !== "packing-slip" ? (
        <dl className="mt-6 ml-auto max-w-xs space-y-1 text-sm">
          <div className="flex justify-between gap-6"><dt>Subtotal</dt><dd>{money(order.subtotal)}</dd></div>
          {Number(order.discount_amount) > 0 ? <div className="flex justify-between gap-6"><dt>Discount</dt><dd>{money(order.discount_amount)}</dd></div> : null}
          <div className="flex justify-between gap-6"><dt>Delivery / shipping</dt><dd>{money(order.shipping_cost)}</dd></div>
          <div className="flex justify-between gap-6 font-semibold"><dt>Total</dt><dd>{money(order.total)}</dd></div>
        </dl>
      ) : null}

      {kind === "receipt" || kind === "summary" ? (
        <p className="mt-4 text-sm">Payment status: {order.payment_status}</p>
      ) : null}

      {kind === "delivery" ? (
        <section className="mt-6 border-t border-black/20 pt-4 text-sm">
          <h2 className="font-semibold">Carrier / courier operations</h2>
          <p className="mt-2">Provider: {order.fulfillment_provider || "Not assigned"}</p>
          {order.fulfillment_service ? <p>Service: {order.fulfillment_service}</p> : null}
          {externalId ? <p className="break-all">External reference: {externalId}</p> : null}
          {tracking ? <p className="break-all">Tracking: {tracking}</p> : <p className="mt-2 text-xs">Tracking and courier details will appear here when UPS, USPS, or DoorDash return them.</p>}
        </section>
      ) : null}

      <p className="mt-10 text-xs">Ivoire Shop · Printed {new Date().toLocaleString()}</p>
    </article>
  );
}
