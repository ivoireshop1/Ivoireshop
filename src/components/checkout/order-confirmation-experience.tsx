"use client";

import Link from "next/link";
import { CopyConfirmationButton } from "./copy-confirmation-button";
import type { CheckoutReceipt } from "@/src/lib/checkout/checkout-validation";
import { maskEmail } from "@/src/lib/customer/mask-email";
import { paymentProviderLabel, paymentStatusLabel } from "@/src/lib/orders/status";
import { fulfillmentDisplay } from "@/src/lib/delivery/labels";

function firstName(name?: string) {
  const token = name?.trim().split(/\s+/)[0];
  return token || "there";
}

function isProcessing(receipt: CheckoutReceipt) {
  return receipt.payment_status === "pending" && Boolean(receipt.payment_provider);
}

export function OrderConfirmationExperience({
  receipt,
  fulfillmentMethod,
  emailSent,
  viewHref,
  onContinue,
}: {
  receipt: CheckoutReceipt;
  fulfillmentMethod: "delivery" | "local_pickup" | string;
  emailSent: boolean;
  viewHref?: string | null;
  onContinue?: () => void;
}) {
  const pickup = fulfillmentMethod === "local_pickup";
  const processing = isProcessing(receipt);
  const confirmed = !processing && receipt.payment_status !== "failed" && receipt.payment_status !== "cancelled";
  const code = receipt.confirmation_code ?? receipt.order_number;
  const masked = receipt.customer_email ? maskEmail(receipt.customer_email) : "";

  return (
    <section className="order-confirm-stage overflow-hidden rounded-[28px] bg-[#f5f0e6] p-6 sm:p-10">
      <div className={`order-confirm-check mx-auto flex h-20 w-20 items-center justify-center rounded-full ${confirmed ? "bg-forest-green text-white" : "bg-white text-forest-green"}`}>
        <span aria-hidden="true" className="text-4xl">{confirmed ? "✓" : "•"}</span>
      </div>
      <p className="mt-6 text-center text-xs font-semibold uppercase tracking-[0.22em] text-gold">
        {confirmed ? "Order confirmed" : processing ? "Payment is processing" : "Order update"}
      </p>
      <h1 className="mt-3 text-center text-4xl font-semibold text-forest-green">
        {confirmed ? `You're all set, ${firstName(receipt.customer_name)}!` : processing ? "We're confirming your payment" : "Your order is saved"}
      </h1>
      <div className="order-confirm-code mt-8 rounded-[24px] border border-gold/40 bg-white px-5 py-8 text-center">
        <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-gold">Your confirmation code</p>
        <p className="mt-3 break-all font-mono text-4xl font-semibold tracking-[0.18em] text-forest-green sm:text-5xl">{code}</p>
        {receipt.confirmation_code ? (
          <div className="mt-5 flex justify-center">
            <CopyConfirmationButton code={receipt.confirmation_code} />
          </div>
        ) : null}
      </div>
      {confirmed ? (
        <p className="mt-6 text-center text-sm leading-7 text-muted">
          {emailSent && masked
            ? `We sent your order details to ${masked}.`
            : "Save your confirmation code. Email confirmations are not available yet."}
        </p>
      ) : processing ? (
        <p className="mt-6 text-center text-sm leading-7 text-muted">Payment is processing. We will confirm it as soon as the provider verifies the charge.</p>
      ) : null}
      <dl className="mt-8 space-y-3 rounded-2xl border border-black/10 bg-white/70 p-5 text-sm">
        <div className="flex justify-between gap-4"><dt className="shrink-0">Order number</dt><dd className="min-w-0 break-all text-right font-semibold text-forest-green">{receipt.order_number}</dd></div>
        <div className="flex justify-between gap-4"><dt className="shrink-0">Fulfillment</dt><dd className="min-w-0 text-right text-forest-green">{fulfillmentDisplay(receipt)}</dd></div>
        {receipt.subtotal != null ? <div className="flex justify-between gap-4"><dt className="shrink-0">Subtotal</dt><dd className="text-right">${Number(receipt.subtotal).toFixed(2)}</dd></div> : null}
        <div className="flex justify-between gap-4"><dt className="shrink-0">Shipping / Delivery</dt><dd className="text-right">${Number(receipt.shipping_cost ?? 0).toFixed(2)}</dd></div>
        <div className="flex justify-between gap-4"><dt className="shrink-0">Tax</dt><dd className="text-right">${Number(receipt.tax_amount ?? 0).toFixed(2)}</dd></div>
        <div className="flex justify-between gap-4"><dt className="shrink-0">Payment status</dt><dd className="min-w-0 text-right text-forest-green">{paymentStatusLabel(receipt.payment_status ?? "pending", receipt.payment_provider)}</dd></div>
        <div className="flex justify-between gap-4"><dt className="shrink-0">Payment method</dt><dd className="min-w-0 text-right text-forest-green">{paymentProviderLabel(receipt.payment_provider, receipt.payment_method)}</dd></div>
        <div className="flex justify-between gap-4"><dt className="shrink-0">Total</dt><dd className="text-right font-semibold text-forest-green">${Number(receipt.total).toFixed(2)}</dd></div>
      </dl>
      <p className="mt-6 text-center text-sm leading-7 text-muted">
        {pickup
          ? "We'll let you know when your order is ready for pickup."
          : "We'll keep you updated as your order makes its way to you."}
      </p>
      <div className="mt-8 flex flex-wrap justify-center gap-3">
        {viewHref ? (
          <Link className="min-h-11 rounded-lg bg-forest-green px-5 py-3 text-sm font-semibold text-white" href={viewHref}>
            View Order
          </Link>
        ) : null}
        <Link className="min-h-11 rounded-lg border border-forest-green/20 px-5 py-3 text-sm font-semibold text-forest-green" href="/shop" onClick={onContinue}>
          Continue Shopping
        </Link>
      </div>
    </section>
  );
}
