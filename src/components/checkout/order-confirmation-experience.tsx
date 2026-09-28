"use client";

import Link from "next/link";
import { CopyConfirmationButton } from "./copy-confirmation-button";
import type { CheckoutReceipt } from "@/src/lib/checkout/checkout-validation";

function firstName(name?: string) {
  const token = name?.trim().split(/\s+/)[0];
  return token || "there";
}

function paymentLabel(receipt: CheckoutReceipt) {
  if (receipt.payment_provider === "square" || receipt.payment_method === "square") return "Square";
  if (receipt.payment_provider === "paypal" || receipt.payment_method === "paypal") return "PayPal";
  return (receipt.payment_method || "Online payment").replaceAll("_", " ");
}

function paymentStatusLabel(status?: string) {
  if (status === "paid") return "Paid";
  if (status === "pending") return "Payment is processing";
  if (status === "failed") return "Failed";
  if (status === "cancelled") return "Cancelled";
  if (status === "refunded") return "Refunded";
  return (status || "Pending").replaceAll("_", " ");
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
  viewHref: string;
  onContinue?: () => void;
}) {
  const pickup = fulfillmentMethod === "local_pickup";
  const paid = receipt.payment_status === "paid";
  const pending = receipt.payment_status === "pending";
  const code = receipt.confirmation_code ?? receipt.order_number;

  return (
    <section className="order-confirm-stage overflow-hidden rounded-[28px] bg-[#f5f0e6] p-6 sm:p-10">
      <div className={`order-confirm-check mx-auto flex h-20 w-20 items-center justify-center rounded-full ${paid ? "bg-forest-green text-white" : "bg-white text-forest-green"}`}>
        <span aria-hidden="true" className="text-4xl">{paid ? "✓" : "•"}</span>
      </div>
      <p className="mt-6 text-center text-xs font-semibold uppercase tracking-[0.22em] text-gold">
        {paid ? "Order confirmed" : pending ? "Payment is processing" : "Order update"}
      </p>
      <h1 className="mt-3 text-center text-4xl font-semibold text-forest-green">
        {paid ? `You're all set, ${firstName(receipt.customer_name)}!` : pending ? "We're confirming your payment" : "Your order is saved"}
      </h1>
      <div className="order-confirm-code mt-8 rounded-[24px] border border-gold/40 bg-white/80 px-5 py-8 text-center">
        <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-gold">Your confirmation code</p>
        <p className="mt-3 font-mono text-4xl font-semibold tracking-[0.18em] text-forest-green sm:text-5xl">{code}</p>
        {receipt.confirmation_code ? (
          <div className="mt-5 flex justify-center">
            <CopyConfirmationButton code={receipt.confirmation_code} />
          </div>
        ) : null}
      </div>
      {paid ? (
        <p className="mt-6 text-center text-sm leading-7 text-muted">
          {emailSent
            ? `We sent the details to ${receipt.customer_email}.`
            : "Your order is confirmed. We couldn't send the email right now, so save your confirmation code."}
        </p>
      ) : pending ? (
        <p className="mt-6 text-center text-sm leading-7 text-muted">Payment is processing. We will confirm it as soon as the provider verifies the charge.</p>
      ) : null}
      <dl className="mt-8 space-y-3 rounded-2xl border border-black/10 bg-white/70 p-5 text-sm">
        <div className="flex justify-between gap-4"><dt>Order #</dt><dd className="font-semibold text-forest-green">{receipt.order_number}</dd></div>
        <div className="flex justify-between gap-4"><dt>Confirmation code</dt><dd className="font-semibold tracking-wide text-forest-green">{code}</dd></div>
        <div className="flex justify-between gap-4"><dt>{pickup ? "Pickup" : "Delivery"}</dt><dd className="text-forest-green">{pickup ? "Local pickup" : "Delivery"}</dd></div>
        <div className="flex justify-between gap-4"><dt>Payment method</dt><dd className="text-forest-green">{paymentLabel(receipt)}</dd></div>
        <div className="flex justify-between gap-4"><dt>Payment status</dt><dd className="capitalize text-forest-green">{paymentStatusLabel(receipt.payment_status)}</dd></div>
        <div className="flex justify-between gap-4"><dt>Order total</dt><dd className="font-semibold text-forest-green">${Number(receipt.total).toFixed(2)}</dd></div>
      </dl>
      <p className="mt-6 text-center text-sm leading-7 text-muted">
        {pickup
          ? "We'll let you know when your order is ready for pickup."
          : "We'll keep you updated as your order makes its way to you."}
      </p>
      <div className="mt-8 flex flex-wrap justify-center gap-3">
        <Link className="rounded-lg bg-forest-green px-5 py-3 text-sm font-semibold text-white" href={viewHref}>
          View Order
        </Link>
        <Link className="rounded-lg border border-forest-green/20 px-5 py-3 text-sm font-semibold text-forest-green" href="/shop" onClick={onContinue}>
          Continue Shopping
        </Link>
      </div>
    </section>
  );
}
