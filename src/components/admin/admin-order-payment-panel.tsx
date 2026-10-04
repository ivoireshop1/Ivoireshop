"use client";

import { useState, useTransition } from "react";
import { refundStripeOrder } from "@/src/lib/payments/stripe-actions";
import { paymentHeaderLabel, paidAmountDisplay } from "@/src/lib/orders/ops";
import { paymentProviderLabel, paymentStatusLabel } from "@/src/lib/orders/status";
import { OrderMoneyBreakdown } from "@/src/components/orders/order-money-breakdown";
import { formatStoreDateTime } from "@/src/lib/store/timezone";
import { stripeDashboardPaymentUrl, type StripeMode } from "@/src/lib/payments/stripe-config";
import { requiresStripePaymentBeforeFulfillment } from "@/src/lib/payments/totals";

export function AdminOrderPaymentPanel({
  order,
  stripeMode,
}: {
  stripeMode?: StripeMode | null;
  order: {
    id: string;
    order_number: string;
    payment_status: string;
    payment_method?: string | null;
    payment_provider?: string | null;
    provider_payment_id?: string | null;
    paid_at?: string | null;
    amount_paid?: number | string | null;
    refunded_amount?: number | string | null;
    subtotal: number | string;
    shipping_cost: number | string;
    discount_amount?: number | string;
    tax_amount?: number | string;
    total: number | string;
  };
}) {
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState(false);
  const [, startTransition] = useTransition();
  const paid = order.amount_paid != null && Number(order.amount_paid) > 0 ? Number(order.amount_paid) : paidAmountDisplay(order.payment_status, order.total);
  const refunded = Number(order.refunded_amount ?? 0);
  const refundable = Math.max(0, Number(paid ?? 0) - refunded);
  const dashboard = order.payment_provider === "stripe" ? stripeDashboardPaymentUrl(stripeMode, order.provider_payment_id) : "";
  const unpaidGuard = requiresStripePaymentBeforeFulfillment(order);

  function refund() {
    if (busy) return;
    setBusy(true);
    setError(null);
    startTransition(async () => {
      const result = await refundStripeOrder(order.id, confirm);
      setBusy(false);
      if (result.error) {
        setError(result.error);
        return;
      }
      setSaved(true);
      setConfirm("");
    });
  }

  return (
    <section className="rounded-2xl bg-white p-5">
      <h2 className="font-semibold text-[#173f35]">Payment</h2>
      <p className="mt-3 text-sm font-semibold text-[#173f35]">{paymentHeaderLabel(order.payment_status, order.payment_provider)}</p>
      <p className="mt-1 text-sm text-[#6b6b6b]">Payment Provider: {paymentProviderLabel(order.payment_provider, order.payment_method)}</p>
      <p className="mt-1 text-sm text-[#6b6b6b]">Status: {paymentStatusLabel(order.payment_status, order.payment_provider)}</p>
      <div className="mt-4">
        <OrderMoneyBreakdown
          discount={order.discount_amount}
          shipping={order.shipping_cost}
          subtotal={order.subtotal}
          tax={order.tax_amount}
          total={order.total}
        />
      </div>
      <p className="mt-3 text-sm text-[#173f35]">Amount: ${Number(order.total).toFixed(2)}</p>
      {paid != null ? <p className="mt-1 text-sm text-[#173f35]">Paid: ${paid.toFixed(2)}</p> : <p className="mt-1 text-sm text-[#6b6b6b]">No paid amount on file.</p>}
      {refunded > 0 ? <p className="mt-1 text-sm text-[#173f35]">Refunded: ${refunded.toFixed(2)}</p> : null}
      {order.paid_at ? <p className="mt-1 text-sm text-[#6b6b6b]">Paid at: {formatStoreDateTime(order.paid_at)}</p> : null}
      {order.provider_payment_id ? <p className="mt-2 break-all text-xs text-[#6b6b6b]">Payment reference: {order.provider_payment_id}</p> : null}
      {dashboard ? (
        <a className="mt-3 inline-flex min-h-11 items-center text-sm font-semibold text-[#173f35] underline" href={dashboard} rel="noreferrer" target="_blank">
          View in Stripe
        </a>
      ) : null}
      {unpaidGuard ? <p className="mt-3 rounded-xl bg-[#f3efe9] p-3 text-sm text-[#7c5d1a]">Collect Stripe payment before fulfillment.</p> : null}
      {order.payment_provider === "stripe" && refundable > 0 && (order.payment_status === "paid" || order.payment_status === "partially_refunded") ? (
        <div className="mt-5 space-y-3 rounded-xl border border-[#173f35]/10 p-4">
          <h3 className="font-semibold text-[#173f35]">Refund</h3>
          <p className="text-sm text-[#6b6b6b]">Order {order.order_number}. Maximum refundable ${refundable.toFixed(2)}. Type REFUND to confirm a full remaining refund.</p>
          <input className="min-h-11 w-full rounded-xl border border-[#173f35]/15 px-3" onChange={(event) => setConfirm(event.target.value)} placeholder="REFUND" value={confirm} />
          <button className="min-h-11 rounded-xl bg-[#173f35] px-4 text-sm font-semibold text-white disabled:opacity-50" disabled={busy || confirm !== "REFUND"} onClick={refund} type="button">
            {busy ? "Processing…" : "Refund in Stripe"}
          </button>
          {error ? <p className="text-sm text-red-800">{error}</p> : null}
          {saved ? <p className="text-sm text-[#173f35]">Refund submitted. Payment updates when Stripe confirms the webhook.</p> : null}
        </div>
      ) : null}
    </section>
  );
}
