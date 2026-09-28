"use client";

import Link from "next/link";
import { FormEvent, useCallback, useEffect, useRef, useState, useTransition } from "react";
import { SmartBackButton } from "@/src/components/navigation/smart-back-button";
import { useCart } from "@/src/lib/cart/cart-context";
import { useRouter } from "next/navigation";
import { placeCheckoutOrder } from "@/src/lib/checkout/actions";
import { validateCheckout, type CheckoutReceipt } from "@/src/lib/checkout/checkout-validation";
import { readCheckoutAttempt, storeCheckoutAttempt, forgetCheckoutAttempt, type CheckoutAttempt } from "@/src/lib/checkout/checkout-session";
import { STORE_CLOSED_MESSAGE } from "@/src/lib/store/constants";
import { FulfillmentMethodCards } from "@/src/components/checkout/fulfillment-method-cards";
import { useFulfillmentMethod } from "@/src/lib/fulfillment/use-fulfillment-method";
import { PaymentMethodCards, type CheckoutPaymentProvider } from "@/src/components/checkout/payment-method-cards";
import { SquareCardFields } from "@/src/components/checkout/square-card-fields";
import { PaypalCheckoutButtons } from "@/src/components/checkout/paypal-checkout-buttons";
import { OrderConfirmationExperience } from "@/src/components/checkout/order-confirmation-experience";
import { viewOrderHref } from "@/src/lib/checkout/view-order-href";
import { capturePaypalPayment, markPaypalCancelled, payWithSquare, startPaypalPayment } from "@/src/lib/payments/actions";
import type { PublicPaymentConfig } from "@/src/lib/payments/readiness";
import type { PaymentEnvironment } from "@/src/lib/payments/public";

export function CheckoutPage({ storeOpen, payments }: { storeOpen: boolean; payments: PublicPaymentConfig }) {
  const { items, subtotal, isLoaded, completePurchase } = useCart();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [confirmation, setConfirmation] = useState<CheckoutAttempt | null>(null);
  const [emailSent, setEmailSent] = useState(false);
  const [fulfillmentMethod] = useFulfillmentMethod();
  const [attempt, setAttempt] = useState<CheckoutAttempt | null>(null);
  const [sessionReady, setSessionReady] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<CheckoutPaymentProvider | null>(
    payments.square.ready ? "square" : payments.paypal.ready ? "paypal" : null,
  );
  const tokenizeRef = useRef<(() => Promise<string>) | null>(null);
  const submitting = useRef(false);
  const [, startTransition] = useTransition();
  const router = useRouter();
  const recovered = useRef(false);
  const setTokenize = useCallback((tokenize: () => Promise<string>) => {
    tokenizeRef.current = tokenize;
  }, []);

  useEffect(() => {
    if (!isLoaded || !confirmation?.receipt || recovered.current) return;
    const timer = window.setTimeout(() => {
      recovered.current = true;
      try { completePurchase(confirmation.items, confirmation.receipt!.order_id); }
      catch { setError("Your order is confirmed, but cart storage could not be updated. Keep your confirmation code and review your cart before ordering again."); }
    }, 0);
    return () => window.clearTimeout(timer);
  }, [isLoaded, confirmation, completePurchase]);
  useEffect(() => {
    const timer = window.setTimeout(() => {
      const saved = readCheckoutAttempt();
      if (saved?.receipt?.payment_status === "paid" || (saved?.receipt?.payment_status === "pending" && saved.receipt.confirmation_code && !saved.receipt.payment_provider)) {
        setConfirmation(saved);
        setEmailSent(saved.receipt.email_sent === true);
      } else if (saved) {
        setAttempt(saved);
      }
      setSessionReady(true);
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  function withReceipt(current: CheckoutAttempt, receipt: CheckoutReceipt): CheckoutAttempt {
    return {
      ...current,
      receipt: {
        ...current.receipt,
        ...receipt,
        account_order: current.receipt?.account_order === true || receipt.account_order === true,
        guest_access_token: receipt.guest_access_token || current.receipt?.guest_access_token,
      },
    };
  }

  function persist(next: CheckoutAttempt) {
    try { storeCheckoutAttempt(next); } catch { /* Pending key remains available for recovery. */ }
  }

  async function ensureOrder(current: CheckoutAttempt): Promise<{ ok: true; attempt: CheckoutAttempt; receipt: CheckoutReceipt } | { ok: false; error: string; retrySame?: boolean }> {
    if (current.receipt?.order_id) return { ok: true, attempt: current, receipt: current.receipt };
    const result = await placeCheckoutOrder(current.request);
    if (!result.success) return { ok: false, error: result.error, retrySame: result.retrySame };
    const completed = { ...current, receipt: result.receipt };
    persist(completed);
    setAttempt(completed);
    return { ok: true, attempt: completed, receipt: result.receipt };
  }

  function showConfirmed(next: CheckoutAttempt, sent: boolean) {
    persist({ ...next, receipt: { ...next.receipt!, email_sent: sent } });
    setEmailSent(sent);
    setConfirmation({ ...next, receipt: { ...next.receipt!, email_sent: sent } });
    try { completePurchase(next.items, next.receipt!.order_id); }
    catch { setError("Your order is confirmed, but cart storage could not be updated. Review your cart before ordering again."); }
    router.refresh();
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting.current || confirmation || !sessionReady) return;
    if (!payments.enabled) { /* Unpaid Place Order is allowed when Square/PayPal are not configured. */ }
    else if (!paymentMethod) { setError("Choose Square or PayPal."); return; }
    const form = new FormData(event.currentTarget);
    const value = (name: string) => String(form.get(name) ?? "").trim();
    const candidate = attempt?.request ?? {
      items: items.map(({ productId, quantity }) => ({ product_id: productId, quantity })),
      customerName: value("customerName"), customerEmail: value("customerEmail"), customerPhone: value("customerPhone"),
      address: { address_line_1: value("addressLine1"), address_line_2: value("addressLine2"), city: value("city"), state: value("state"), postal_code: value("postalCode"), country: value("country") },
      fulfillmentMethod, idempotencyKey: crypto.randomUUID(),
    };
    const validated = validateCheckout(candidate);
    if (validated.error) { setError(validated.error); return; }
    const pending: CheckoutAttempt = attempt ?? {
      request: validated.request!, items: items.map(({ productId, name, quantity }) => ({ productId, name, quantity })), createdAt: Date.now(),
    };
    try { storeCheckoutAttempt(pending); }
    catch { setError("Enable browser session storage before placing an order so retries can be recovered safely."); return; }
    submitting.current = true;
    setIsSubmitting(true);
    setError("");
    setAttempt(pending);
    startTransition(async () => {
      try {
        if (!payments.enabled) {
          const created = await ensureOrder(pending);
          if (!created.ok) {
            setError(created.error);
            if (!created.retrySame) { forgetCheckoutAttempt(); setAttempt(null); }
            return;
          }
          showConfirmed(created.attempt, created.receipt.email_sent === true);
          return;
        }
        if (paymentMethod === "square") {
          const token = tokenizeRef.current ? await tokenizeRef.current() : "";
          if (!token) { setError("Enter your card details to pay securely with Square."); return; }
          const created = await ensureOrder(pending);
          if (!created.ok) {
            setError(created.error);
            if (!created.retrySame) { forgetCheckoutAttempt(); setAttempt(null); }
            return;
          }
          const paid = await payWithSquare({ idempotencyKey: created.attempt.request.idempotencyKey, sourceId: token });
          if (!paid.success) {
            setError(paid.error);
            if (paid.pending && paid.receipt) {
              const processing = withReceipt(created.attempt, paid.receipt);
              persist(processing);
              setConfirmation(processing);
            }
            return;
          }
          showConfirmed(withReceipt(created.attempt, { ...paid.receipt, email_sent: paid.emailSent }), paid.emailSent);
          return;
        }
        setError("Use the PayPal button to pay securely.");
      } catch {
        setError("The connection was interrupted. Your cart is safe. Retry the pending order; it will use the same checkout key.");
      } finally {
        submitting.current = false;
        setIsSubmitting(false);
      }
    });
  }

  async function paypalCreateOrder() {
    const form = document.querySelector("form");
    const nativeForm = form instanceof HTMLFormElement ? form : null;
    const value = (name: string) => String(nativeForm?.elements.namedItem(name) instanceof HTMLInputElement ? (nativeForm.elements.namedItem(name) as HTMLInputElement).value : "").trim();
    const candidate = attempt?.request ?? {
      items: items.map(({ productId, quantity }) => ({ product_id: productId, quantity })),
      customerName: value("customerName"), customerEmail: value("customerEmail"), customerPhone: value("customerPhone"),
      address: { address_line_1: value("addressLine1"), address_line_2: value("addressLine2"), city: value("city"), state: value("state"), postal_code: value("postalCode"), country: value("country") },
      fulfillmentMethod, idempotencyKey: crypto.randomUUID(),
    };
    const validated = validateCheckout(candidate);
    if (validated.error) throw new Error(validated.error);
    const pending: CheckoutAttempt = attempt ?? {
      request: validated.request!, items: items.map(({ productId, name, quantity }) => ({ productId, name, quantity })), createdAt: Date.now(),
    };
    storeCheckoutAttempt(pending);
    setAttempt(pending);
    const created = await ensureOrder(pending);
    if (!created.ok) throw new Error(created.error);
    const started = await startPaypalPayment({ idempotencyKey: created.attempt.request.idempotencyKey });
    if (!started.success) throw new Error(started.error);
    if ("paypalOrderId" in started) return started.paypalOrderId;
    showConfirmed(withReceipt(created.attempt, started.receipt), started.emailSent);
    throw new Error("This order is already paid.");
  }

  async function paypalApprove(paypalOrderId: string) {
    if (!attempt?.request.idempotencyKey && !confirmation) return;
    const key = (attempt ?? confirmation)!.request.idempotencyKey;
    const paid = await capturePaypalPayment({ idempotencyKey: key, paypalOrderId });
    if (!paid.success) {
      setError(paid.error);
      if (paid.pending && paid.receipt && attempt) {
        const processing = withReceipt(attempt, paid.receipt);
        persist(processing);
        setConfirmation(processing);
      }
      return;
    }
    showConfirmed(withReceipt((attempt ?? confirmation)!, { ...paid.receipt, email_sent: paid.emailSent }), paid.emailSent);
  }

  if (!isLoaded || !sessionReady) {
    return (
      <main className="mx-auto w-full max-w-4xl px-5 py-16 lg:px-8">
        <p className="text-muted">Loading checkout...</p>
      </main>
    );
  }

  if (confirmation?.receipt) {
    return (
      <main className="mx-auto w-full max-w-4xl px-5 py-10 lg:px-8">
        {error && <p role="alert" className="mb-4 text-sm text-red-900">{error}</p>}
        <OrderConfirmationExperience
          emailSent={emailSent}
          fulfillmentMethod={confirmation.request.fulfillmentMethod}
          receipt={confirmation.receipt}
          viewHref={viewOrderHref({
            orderId: confirmation.receipt.order_id,
            guestAccessToken: confirmation.receipt.guest_access_token,
            accountOrder: confirmation.receipt.account_order === true,
          })}
          onContinue={() => { forgetCheckoutAttempt(); }}
        />
      </main>
    );
  }

  if (!attempt && items.length === 0) {
    return <main className="mx-auto max-w-2xl px-5 py-20 text-center"><h1 className="text-3xl font-semibold text-forest-green">Your cart is empty</h1><p className="mt-4 text-muted">Add products before checking out.</p><Link className="mt-8 inline-flex rounded-lg bg-forest-green px-6 py-3 text-white" href="/shop">Browse the shop</Link></main>;
  }

  const squarePublic = payments.square.public;
  const paypalPublic = payments.paypal.public;

  return (
    <main className="mx-auto w-full max-w-4xl px-5 py-10 lg:px-8">
      <SmartBackButton fallbackHref="/cart" fallbackLabel="Back to cart" />
      <div className="mt-8 rounded-2xl bg-[#f5f0e6] p-6 sm:p-10">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-gold">Secure checkout</p>
        <h1 className="mt-2 text-4xl font-semibold text-forest-green">Checkout</h1>
        <p className="mt-4 max-w-lg leading-7 text-muted">
          {storeOpen
            ? payments.enabled
              ? payments.message
              : "Online payment is not available yet. The store will contact you regarding payment."
            : STORE_CLOSED_MESSAGE}
        </p>
        {attempt && <div role="status" className="mt-6 space-y-2 rounded-xl border border-gold/40 bg-white p-4 text-sm break-words"><p>A previous order request is awaiting confirmation. Retry it below before starting another order. Your original items and details will be used.</p><p>{attempt.request.customerName} &middot; {attempt.request.customerEmail}</p><p>{attempt.request.fulfillmentMethod === "delivery" ? [attempt.request.address.address_line_1, attempt.request.address.city, attempt.request.address.country].filter(Boolean).join(", ") : "Local pickup"}</p></div>}
        <form aria-describedby={error ? "checkout-error" : undefined} className="mt-8 space-y-7" onSubmit={handleSubmit}>
          <fieldset disabled={isSubmitting || Boolean(attempt)} className="space-y-7">
          <fieldset className="space-y-4 border-t border-black/10 pt-6">
            <legend className="font-semibold text-forest-green">Your details</legend>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field hint="We'll send your receipt and pickup/delivery updates here." label="Email address" name="customerEmail" required type="email" />
              <Field label="Full name" name="customerName" required />
            </div>
            <Field label="Phone number" name="customerPhone" required type="tel" />
          </fieldset>

          <fieldset className="space-y-4 border-t border-black/10 pt-6">
            <legend className="font-semibold text-forest-green">Fulfillment</legend>
            <FulfillmentMethodCards />
          </fieldset>

          {fulfillmentMethod === "delivery" ? (
            <fieldset className="space-y-4 border-t border-black/10 pt-6">
              <legend className="font-semibold text-forest-green">Delivery address</legend>
              <Field label="Address line 1" name="addressLine1" required />
              <Field label="Address line 2 (optional)" name="addressLine2" />
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="City" name="city" required />
                <Field label="State / region (optional)" name="state" />
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Postal code (optional)" name="postalCode" />
                <Field label="Country" name="country" required />
              </div>
            </fieldset>
          ) : (
            <p className="rounded-xl border border-forest-green/10 bg-white/60 px-4 py-3 text-sm text-muted">
              We’ll have your groceries ready for pickup. No delivery address is needed.
            </p>
          )}

          </fieldset>

          <fieldset className="space-y-4 border-t border-black/10 pt-6">
            <legend className="font-semibold text-forest-green">Payment</legend>
            <PaymentMethodCards
              paypalReady={payments.paypal.ready}
              squareReady={payments.square.ready}
              value={paymentMethod}
              onChange={setPaymentMethod}
            />
            {!payments.enabled ? (
              <p className="rounded-xl border border-forest-green/10 bg-white/70 px-4 py-3 text-sm text-muted">
                Online payment is not available yet. The store will contact you regarding payment.
              </p>
            ) : null}
            {payments.enabled && paymentMethod === "square" && squarePublic?.applicationId && squarePublic.locationId && squarePublic.environment ? (
              <SquareCardFields
                applicationId={squarePublic.applicationId}
                environment={squarePublic.environment as PaymentEnvironment}
                locationId={squarePublic.locationId}
                onReady={setTokenize}
              />
            ) : null}
            {payments.enabled && paymentMethod === "paypal" && paypalPublic?.clientId && paypalPublic.environment ? (
              <PaypalCheckoutButtons
                clientId={paypalPublic.clientId}
                createOrder={paypalCreateOrder}
                environment={paypalPublic.environment as PaymentEnvironment}
                onApprove={paypalApprove}
                onCancel={async () => {
                  if (attempt?.request.idempotencyKey) await markPaypalCancelled({ idempotencyKey: attempt.request.idempotencyKey });
                  setError("PayPal checkout was cancelled.");
                }}
                onError={() => setError("Payment couldn't be completed. Please try again.")}
              />
            ) : null}
          </fieldset>

          {error ? (
            <p aria-live="polite" className="rounded-lg border border-red-900/15 bg-white/60 px-4 py-3 text-sm text-red-900" id="checkout-error" role="alert">
              {error}
            </p>
          ) : null}

          <div className="rounded-xl bg-white/70 p-4 text-sm">
            <h2 className="font-semibold text-forest-green">Order summary</h2>
            {(attempt?.items ?? items).map((item) => <p className="mt-2" key={item.productId}>{item.name} &times; {item.quantity}</p>)}
            <p className="mt-3 text-muted">
              {payments.enabled
                ? "Final prices are confirmed by the store, then Square or PayPal is charged that verified total."
                : "Online payment is not available yet. The store will contact you regarding payment."}
            </p>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-4 border-t border-black/10 pt-6">
            <div className="text-sm text-muted">
              <span className="font-semibold text-forest-green">
                {(attempt?.items ?? items).length} product{(attempt?.items ?? items).length === 1 ? "" : "s"}
              </span>
              {attempt ? " — awaiting confirmed total" : ` · $${subtotal.toFixed(2)} estimated subtotal`}
            </div>
            {payments.enabled && paymentMethod === "paypal" ? (
              <p className="text-sm font-semibold text-forest-green">Pay securely with PayPal</p>
            ) : (
              <button
                className="min-h-11 rounded-lg bg-forest-green px-5 py-3 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
                disabled={!storeOpen || isSubmitting || (!attempt && items.length === 0) || (payments.enabled && paymentMethod !== "square")}
                type="submit"
              >
                {isSubmitting
                  ? payments.enabled ? "Paying securely..." : "Placing order..."
                  : payments.enabled
                    ? attempt ? "Retry payment" : "Pay securely with Square"
                    : attempt ? "Retry order" : "Place Order"}
              </button>
            )}
          </div>
        </form>
        <div className="mt-6 flex flex-wrap gap-3">
          <Link className="text-sm font-semibold text-forest-green underline underline-offset-4" href="/cart">
            Back to cart
          </Link>
          <Link className="text-sm font-semibold text-forest-green underline underline-offset-4" href="/shop">
            Continue shopping
          </Link>
        </div>
      </div>
    </main>
  );
}

function Field({ label, name, required = false, type = "text", hint }: { label: string; name: string; required?: boolean; type?: string; hint?: string }) {
  const hintId = hint ? `${name}-hint` : undefined;
  return (
    <label className="block text-sm font-medium" htmlFor={name}>
      {label}
      <input aria-describedby={hintId} className="mt-2 w-full rounded-lg border border-black/15 bg-white px-4 py-3" id={name} name={name} required={required} type={type} />
      {hint ? <span className="mt-2 block text-xs font-normal text-muted" id={hintId}>{hint}</span> : null}
    </label>
  );
}
