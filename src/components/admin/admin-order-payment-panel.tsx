import { paymentHeaderLabel, paidAmountDisplay } from "@/src/lib/orders/ops";
import { paymentProviderLabel, paymentStatusLabel } from "@/src/lib/orders/status";
import { OrderMoneyBreakdown } from "@/src/components/orders/order-money-breakdown";

export function AdminOrderPaymentPanel({
  order,
}: {
  order: {
    payment_status: string;
    payment_method?: string | null;
    payment_provider?: string | null;
    provider_payment_id?: string | null;
    subtotal: number | string;
    shipping_cost: number | string;
    discount_amount?: number | string;
    tax_amount?: number | string;
    total: number | string;
  };
}) {
  const paid = paidAmountDisplay(order.payment_status, order.total);
  return (
    <section className="rounded-2xl bg-white p-5">
      <h2 className="font-semibold text-[#173f35]">Payment</h2>
      <p className="mt-3 text-sm font-semibold text-[#173f35]">{paymentHeaderLabel(order.payment_status, order.payment_provider)}</p>
      <p className="mt-1 text-sm text-[#6b6b6b]">{paymentStatusLabel(order.payment_status, order.payment_provider)}</p>
      <p className="mt-1 text-sm text-[#6b6b6b]">Method: {paymentProviderLabel(order.payment_provider, order.payment_method)}</p>
      <div className="mt-4">
        <OrderMoneyBreakdown
          discount={order.discount_amount}
          shipping={order.shipping_cost}
          subtotal={order.subtotal}
          tax={order.tax_amount}
          total={order.total}
        />
      </div>
      {paid != null ? <p className="mt-3 text-sm text-[#173f35]">Paid amount: ${paid.toFixed(2)}</p> : <p className="mt-3 text-sm text-[#6b6b6b]">No paid amount on file. Do not treat this order as collected unless payment status is Paid.</p>}
      {order.provider_payment_id ? <p className="mt-2 break-all text-xs text-[#6b6b6b]">Payment reference: {order.provider_payment_id}</p> : null}
    </section>
  );
}
