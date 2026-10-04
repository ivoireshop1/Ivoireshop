"use client";

import { loadStripe, type Stripe } from "@stripe/stripe-js";
import { Elements, PaymentElement, useElements, useStripe } from "@stripe/react-stripe-js";
import { useEffect, useMemo, useRef, useState } from "react";
import { stripePaymentStatus } from "@/src/lib/payments/stripe-actions";
import type { CheckoutReceipt } from "@/src/lib/checkout/checkout-validation";

const loaders = new Map<string, Promise<Stripe | null>>();

function stripePromise(publishableKey: string) {
  let pending = loaders.get(publishableKey);
  if (!pending) {
    pending = loadStripe(publishableKey);
    loaders.set(publishableKey, pending);
  }
  return pending;
}

export function StripeCheckoutForm({
  clientSecret,
  publishableKey,
  idempotencyKey,
  disabled,
  amountLabel,
  onPaid,
  onError,
}: {
  clientSecret: string;
  publishableKey: string;
  idempotencyKey: string;
  disabled?: boolean;
  amountLabel: string;
  onPaid: (receipt: CheckoutReceipt) => void;
  onError: (message: string) => void;
}) {
  const options = useMemo(() => ({
    clientSecret,
    appearance: {
      theme: "stripe" as const,
      variables: {
        colorPrimary: "#173f35",
        colorText: "#173f35",
        borderRadius: "12px",
      },
    },
  }), [clientSecret]);
  return (
    <Elements options={options} stripe={stripePromise(publishableKey)}>
      <PayForm amountLabel={amountLabel} disabled={disabled} idempotencyKey={idempotencyKey} onError={onError} onPaid={onPaid} />
    </Elements>
  );
}

function PayForm({
  idempotencyKey,
  disabled,
  amountLabel,
  onPaid,
  onError,
}: {
  idempotencyKey: string;
  disabled?: boolean;
  amountLabel: string;
  onPaid: (receipt: CheckoutReceipt) => void;
  onError: (message: string) => void;
}) {
  const stripe = useStripe();
  const elements = useElements();
  const [processing, setProcessing] = useState(false);
  const busy = useRef(false);

  useEffect(() => {
    if (!stripe) return;
    const secret = new URLSearchParams(window.location.search).get("payment_intent_client_secret");
    if (!secret) return;
    void stripe.retrievePaymentIntent(secret).then((result) => {
      if (result.paymentIntent?.status === "requires_payment_method") onError("Payment couldn't be completed. Please try again.");
    });
  }, [stripe, onError]);

  async function waitForPaid() {
    for (let attempt = 0; attempt < 12; attempt += 1) {
      const status = await stripePaymentStatus(idempotencyKey);
      if ("error" in status && status.error) return status;
      if (status.receipt?.payment_status === "paid") return status;
      if (status.receipt?.payment_status === "failed") return status;
      await new Promise((resolve) => window.setTimeout(resolve, 400));
    }
    return stripePaymentStatus(idempotencyKey);
  }

  async function pay() {
    if (busy.current || !stripe || !elements) return;
    busy.current = true;
    setProcessing(true);
    const submitted = await elements.submit();
    if (submitted.error) {
      busy.current = false;
      setProcessing(false);
      onError(submitted.error.message || "Enter your payment details.");
      return;
    }
    const confirmed = await stripe.confirmPayment({
      elements,
      confirmParams: {
        return_url: `${window.location.origin}/checkout`,
      },
      redirect: "if_required",
    });
    if (confirmed.error) {
      busy.current = false;
      setProcessing(false);
      onError(confirmed.error.message || "Payment couldn't be completed. Please try again.");
      return;
    }
    const settled = await waitForPaid();
    busy.current = false;
    setProcessing(false);
    if ("error" in settled && settled.error) {
      onError(settled.error);
      return;
    }
    if (settled.receipt?.payment_status === "paid") {
      onPaid(settled.receipt);
      return;
    }
    if (settled.receipt?.payment_status === "failed") {
      onError("Payment couldn't be completed. Please try again.");
      return;
    }
    onError("Payment is processing. Keep this page open and retry in a moment if you do not see confirmation.");
  }

  return (
    <div className="min-w-0 space-y-4 overflow-x-hidden">
      <PaymentElement options={{ layout: "tabs" }} />
      <button
        className="min-h-12 w-full rounded-xl bg-forest-green px-4 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
        disabled={disabled || processing || !stripe || !elements}
        onClick={() => void pay()}
        type="button"
      >
        {processing ? "Processing…" : `Pay ${amountLabel}`}
      </button>
    </div>
  );
}
