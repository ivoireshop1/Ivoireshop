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
import { CheckoutProgress } from "@/src/components/checkout/checkout-progress";
import { CheckoutShippingMethods } from "@/src/components/checkout/checkout-shipping-methods";
import { CheckoutOrderSummary } from "@/src/components/checkout/checkout-order-summary";
import { useFulfillmentMethod } from "@/src/lib/fulfillment/use-fulfillment-method";
import { PaymentMethodCards, type CheckoutPaymentProvider } from "@/src/components/checkout/payment-method-cards";
import { SquareCardFields } from "@/src/components/checkout/square-card-fields";
import { PaypalCheckoutButtons } from "@/src/components/checkout/paypal-checkout-buttons";
import { OrderConfirmationExperience } from "@/src/components/checkout/order-confirmation-experience";
import { getCheckoutDeliveryOptions } from "@/src/lib/delivery/actions";
import type { DeliveryOption } from "@/src/lib/delivery/types";
import { taxDisplayLabel, type TaxSettings } from "@/src/lib/tax/totals";
import { viewOrderHref } from "@/src/lib/checkout/view-order-href";
import { capturePaypalPayment, markPaypalCancelled, payWithSquare, startPaypalPayment } from "@/src/lib/payments/actions";
import type { PublicPaymentConfig } from "@/src/lib/payments/readiness";
import type { PaymentEnvironment } from "@/src/lib/payments/public";
import type { StoreOrigin } from "@/src/lib/delivery/origin";
import { PickupLocationBlock } from "@/src/components/store/pickup-location-block";

export function CheckoutPage({ storeOpen, payments, pickupOrigin = null }: { storeOpen: boolean; payments: PublicPaymentConfig; pickupOrigin?: StoreOrigin | null }) {
  const { items, subtotal, isLoaded, completePurchase } = useCart();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [confirmation, setConfirmation] = useState<CheckoutAttempt | null>(null);
  const [emailSent, setEmailSent] = useState(false);
  const [fulfillmentMethod, setFulfillmentMethod] = useFulfillmentMethod();
  const [deliveryOptionId, setDeliveryOptionId] = useState("");
  const [checkoutStep, setCheckoutStep] = useState<"account" | "shipping" | "payment" | "review">("account");
  const [contact, setContact] = useState({ customerName: "", customerEmail: "", customerPhone: "" });
  const [address, setAddress] = useState({ addressLine1: "", addressLine2: "", city: "", state: "", postalCode: "", country: "US" });
  const [options, setOptions] = useState<DeliveryOption[]>([]);
  const [breakdowns, setBreakdowns] = useState<Record<string, { shipping: number; tax: number; total: number }>>({});
  const [quoteSubtotal, setQuoteSubtotal] = useState<number | null>(null);
  const [taxSettings, setTaxSettings] = useState<TaxSettings | null>(null);
  const [livePickupOrigin, setLivePickupOrigin] = useState<StoreOrigin | null>(pickupOrigin);
  const [quoteBusy, setQuoteBusy] = useState(false);
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

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const cartItems = items.map(({ productId, quantity }) => ({ product_id: productId, quantity }));
      setQuoteBusy(true);
      void getCheckoutDeliveryOptions({
        address: {
          address_line_1: address.addressLine1,
          city: address.city,
          state: address.state,
          postal_code: address.postalCode,
          country: address.country,
        },
        items: cartItems,
      }).then((result) => {
        setOptions(result.options);
        setBreakdowns(result.breakdowns ?? {});
        setQuoteSubtotal(result.subtotal ?? null);
        setTaxSettings(result.tax ?? null);
        if (result.origin) setLivePickupOrigin(result.origin);
        setDeliveryOptionId((current) => {
          if (result.options.some((option) => option.id === current)) return current;
          const next = result.options[0];
          if (next) setFulfillmentMethod(next.fulfillmentMethod);
          return next?.id ?? "";
        });
        setQuoteBusy(false);
      }).catch(() => setQuoteBusy(false));
    }, 250);
    return () => window.clearTimeout(timer);
  }, [address.addressLine1, address.city, address.state, address.postalCode, address.country, items, setFulfillmentMethod]);

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
    const candidate = attempt?.request ?? {
      items: items.map(({ productId, quantity }) => ({ product_id: productId, quantity })),
      customerName: contact.customerName, customerEmail: contact.customerEmail, customerPhone: contact.customerPhone,
      address: { address_line_1: address.addressLine1, address_line_2: address.addressLine2, city: address.city, state: address.state, postal_code: address.postalCode, country: address.country },
      fulfillmentMethod,
      deliveryOptionId: deliveryOptionId || (fulfillmentMethod === "local_pickup" ? "pickup" : "store"),
      idempotencyKey: crypto.randomUUID(),
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
    const candidate = attempt?.request ?? {
      items: items.map(({ productId, quantity }) => ({ product_id: productId, quantity })),
      customerName: contact.customerName, customerEmail: contact.customerEmail, customerPhone: contact.customerPhone,
      address: { address_line_1: address.addressLine1, address_line_2: address.addressLine2, city: address.city, state: address.state, postal_code: address.postalCode, country: address.country },
      fulfillmentMethod,
      deliveryOptionId: deliveryOptionId || (fulfillmentMethod === "local_pickup" ? "pickup" : "store"),
      idempotencyKey: crypto.randomUUID(),
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
          pickupLocation={livePickupOrigin}
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
  const selectedOption = options.find((option) => option.id === deliveryOptionId) ?? null;
  const breakdown = selectedOption ? breakdowns[selectedOption.id] : undefined;
  const summaryItems = attempt?.items ?? items;
  const displaySubtotal = attempt?.receipt?.subtotal ?? quoteSubtotal ?? subtotal;
  const displayShipping = attempt?.receipt?.shipping_cost ?? breakdown?.shipping ?? null;
  const displayTax = attempt?.receipt?.tax_amount ?? breakdown?.tax ?? null;
  const displayTotal = attempt?.receipt?.total ?? breakdown?.total ?? null;
  const taxLabel = taxSettings ? taxDisplayLabel(taxSettings) : "Tax";

  function goShipping() {
    if (!contact.customerName || !contact.customerEmail || !contact.customerPhone) {
      setError("Enter a valid name, email address, and phone number.");
      return;
    }
    setError("");
    setCheckoutStep("shipping");
  }

  function goPayment() {
    if (!deliveryOptionId || !selectedOption) {
      setError("Choose a shipping method.");
      return;
    }
    if (selectedOption.fulfillmentMethod === "delivery" && (!address.addressLine1 || !address.city || !address.country)) {
      setError("Complete your delivery address, city, and country.");
      return;
    }
    setError("");
    setCheckoutStep("payment");
  }

  function goReview() {
    if (payments.enabled && !paymentMethod) {
      setError("Choose Square or PayPal.");
      return;
    }
    setError("");
    setCheckoutStep("review");
  }

  return (
    <main className="mx-auto w-full max-w-4xl overflow-x-hidden px-5 py-10 lg:px-8">
      <SmartBackButton fallbackHref="/cart" fallbackLabel="Back to cart" />
      <div className="mt-8 min-w-0 rounded-2xl bg-[#f5f0e6] p-4 sm:p-10">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-gold">Secure checkout</p>
        <h1 className="mt-2 text-4xl font-semibold text-forest-green">Checkout</h1>
        <div className="mt-6">
          <CheckoutProgress step={checkoutStep} />
        </div>
        <p className="mt-4 max-w-lg leading-7 text-muted">
          {storeOpen
            ? payments.enabled
              ? payments.message
              : "Online payment is not available yet. The store will contact you regarding payment."
            : STORE_CLOSED_MESSAGE}
        </p>
        {attempt && <div role="status" className="mt-6 space-y-2 rounded-xl border border-gold/40 bg-white p-4 text-sm break-words"><p>A previous order request is awaiting confirmation. Retry it below before starting another order. Your original items and details will be used.</p><p>{attempt.request.customerName} &middot; {attempt.request.customerEmail}</p><p>{attempt.request.fulfillmentMethod === "delivery" ? [attempt.request.address.address_line_1, attempt.request.address.city, attempt.request.address.country].filter(Boolean).join(", ") : "Local pickup"}</p></div>}
        <form aria-describedby={error ? "checkout-error" : undefined} className="mt-8 space-y-7" onSubmit={handleSubmit}>
          <fieldset className={checkoutStep === "account" ? "space-y-4" : "hidden"} disabled={isSubmitting || Boolean(attempt)}>
            <legend className="font-semibold text-forest-green">Your details</legend>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field hint="We'll send your receipt and pickup/delivery updates here." label="Email address" name="customerEmail" onChange={(value) => setContact((current) => ({ ...current, customerEmail: value }))} type="email" value={contact.customerEmail} />
              <Field label="Full name" name="customerName" onChange={(value) => setContact((current) => ({ ...current, customerName: value }))} value={contact.customerName} />
            </div>
            <Field label="Phone number" name="customerPhone" onChange={(value) => setContact((current) => ({ ...current, customerPhone: value }))} type="tel" value={contact.customerPhone} />
            <button className="min-h-12 w-full rounded-xl bg-forest-green px-4 text-sm font-semibold text-white" onClick={goShipping} type="button">Continue to Shipping →</button>
          </fieldset>

          <fieldset className={checkoutStep === "shipping" ? "min-w-0 space-y-6" : "hidden"} disabled={isSubmitting || Boolean(attempt)}>
            {selectedOption?.fulfillmentMethod === "delivery" || !selectedOption ? (
              <div className="space-y-4">
                <h2 className="font-semibold text-forest-green">Delivery address</h2>
                <Field label="Address line 1" name="addressLine1" onChange={(value) => setAddress((current) => ({ ...current, addressLine1: value }))} value={address.addressLine1} />
                <Field label="Address line 2 (optional)" name="addressLine2" onChange={(value) => setAddress((current) => ({ ...current, addressLine2: value }))} value={address.addressLine2} />
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="City" name="city" onChange={(value) => setAddress((current) => ({ ...current, city: value }))} value={address.city} />
                  <Field label="State / region (optional)" name="state" onChange={(value) => setAddress((current) => ({ ...current, state: value }))} value={address.state} />
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="Postal code (optional)" name="postalCode" onChange={(value) => setAddress((current) => ({ ...current, postalCode: value }))} value={address.postalCode} />
                  <Field label="Country" name="country" onChange={(value) => setAddress((current) => ({ ...current, country: value }))} value={address.country} />
                </div>
              </div>
            ) : (
              <>
                <input name="addressLine1" type="hidden" value={address.addressLine1} />
                <input name="city" type="hidden" value={address.city} />
                <input name="country" type="hidden" value={address.country} />
                <p className="rounded-xl border border-forest-green/10 bg-white/60 px-4 py-3 text-sm text-muted">We’ll have your groceries ready for pickup. No delivery address is needed.</p>
                <PickupLocationBlock className="rounded-xl border border-forest-green/10 bg-white px-4 py-3" location={livePickupOrigin} />
              </>
            )}
            <CheckoutShippingMethods
              busy={quoteBusy}
              options={options}
              pickupOrigin={livePickupOrigin}
              value={deliveryOptionId}
              onChange={(option) => {
                setDeliveryOptionId(option.id);
                setFulfillmentMethod(option.fulfillmentMethod);
              }}
            />
            <CheckoutOrderSummary
              continueDisabled={!storeOpen || !deliveryOptionId}
              continueLabel="Continue to Payment →"
              items={summaryItems}
              provider={selectedOption?.provider}
              shipping={displayShipping}
              subtotal={displaySubtotal}
              tax={displayTax}
              taxLabel={taxLabel}
              taxMode={taxSettings?.tax_mode}
              total={displayTotal}
              onContinue={goPayment}
            />
            <button className="text-sm font-semibold text-forest-green underline" onClick={() => setCheckoutStep("account")} type="button">Back to account</button>
          </fieldset>

          <fieldset className={checkoutStep === "payment" ? "space-y-4" : "hidden"}>
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
            {!(payments.enabled && paymentMethod === "paypal") ? (
              <button className="min-h-12 w-full rounded-xl bg-forest-green px-4 text-sm font-semibold text-white" onClick={goReview} type="button">Continue to Review →</button>
            ) : null}
            <button className="text-sm font-semibold text-forest-green underline" onClick={() => setCheckoutStep("shipping")} type="button">Back to shipping</button>
          </fieldset>

          <fieldset className={checkoutStep === "review" ? "space-y-4" : "hidden"}>
            {selectedOption?.provider === "pickup" ? (
              <PickupLocationBlock className="rounded-xl border border-forest-green/10 bg-white px-4 py-3" location={livePickupOrigin} />
            ) : null}
            <CheckoutOrderSummary
              continueDisabled={!storeOpen || isSubmitting || (!attempt && items.length === 0) || (payments.enabled && paymentMethod !== "square")}
              continueLabel={
                isSubmitting
                  ? payments.enabled ? "Paying securely..." : "Placing order..."
                  : payments.enabled
                    ? attempt ? "Retry payment" : "Pay securely with Square"
                    : attempt ? "Retry order" : "Place Order"
              }
              continueType="submit"
              items={summaryItems}
              provider={selectedOption?.provider}
              shipping={displayShipping}
              subtotal={displaySubtotal}
              tax={displayTax}
              taxLabel={taxLabel}
              taxMode={taxSettings?.tax_mode}
              total={displayTotal}
            />
            <button className="text-sm font-semibold text-forest-green underline" onClick={() => setCheckoutStep("payment")} type="button">Back to payment</button>
          </fieldset>

          {error ? (
            <p aria-live="polite" className="rounded-lg border border-red-900/15 bg-white/60 px-4 py-3 text-sm text-red-900" id="checkout-error" role="alert">
              {error}
            </p>
          ) : null}
          <input name="deliveryOptionId" type="hidden" value={deliveryOptionId} />
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

function Field({ label, name, required = false, type = "text", hint, value, onChange }: { label: string; name: string; required?: boolean; type?: string; hint?: string; value?: string; onChange?: (value: string) => void }) {
  const hintId = hint ? `${name}-hint` : undefined;
  return (
    <label className="block text-sm font-medium" htmlFor={name}>
      {label}
      <input aria-describedby={hintId} className="mt-2 w-full min-w-0 rounded-lg border border-black/15 bg-white px-4 py-3" id={name} name={name} onChange={onChange ? (event) => onChange(event.target.value) : undefined} required={required} type={type} value={value} />
      {hint ? <span className="mt-2 block text-xs font-normal text-muted" id={hintId}>{hint}</span> : null}
    </label>
  );
}
