"use client";

import Link from "next/link";
import { FormEvent, useEffect, useRef, useState, useTransition } from "react";
import { SmartBackButton } from "@/src/components/navigation/smart-back-button";
import { useCart } from "@/src/lib/cart/cart-context";
import { useRouter } from "next/navigation";
import { placeCheckoutOrder } from "@/src/lib/checkout/actions";
import { validateCheckout } from "@/src/lib/checkout/checkout-validation";
import { readCheckoutAttempt, storeCheckoutAttempt, forgetCheckoutAttempt, type CheckoutAttempt } from "@/src/lib/checkout/checkout-session";
import { FulfillmentMethodCards } from "@/src/components/checkout/fulfillment-method-cards";
import { useFulfillmentMethod } from "@/src/lib/fulfillment/use-fulfillment-method";


export function CheckoutPage() {
  const { items, subtotal, isLoaded, completePurchase } = useCart();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [confirmation, setConfirmation] = useState<CheckoutAttempt | null>(null);
  const [fulfillmentMethod] = useFulfillmentMethod();
  const [attempt, setAttempt] = useState<CheckoutAttempt | null>(null);
  const [sessionReady, setSessionReady] = useState(false);
  const submitting = useRef(false);
  const [, startTransition] = useTransition();
  const router = useRouter();
  const recovered = useRef(false);
  useEffect(() => {
    if (!isLoaded || !confirmation?.receipt || recovered.current) return;
    const timer = window.setTimeout(() => {
      recovered.current = true;
      try { completePurchase(confirmation.items, confirmation.receipt!.order_id); }
      catch { setError("Your order is confirmed, but cart storage could not be updated. Keep your order number and review your cart before ordering again."); }
    }, 0);
    return () => window.clearTimeout(timer);
  }, [isLoaded, confirmation, completePurchase]);
  useEffect(() => {
    const timer = window.setTimeout(() => {
      const saved = readCheckoutAttempt();
      if (saved?.receipt) setConfirmation(saved);
      else setAttempt(saved);
      setSessionReady(true);
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting.current || confirmation || !sessionReady) return;
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
        const result = await placeCheckoutOrder(pending.request);
        if (!result.success) {
          setError(result.error);
          if (!result.retrySame) { forgetCheckoutAttempt(); setAttempt(null); }
          return;
        }
        const completed = { ...pending, receipt: result.receipt };
        // Persist the actual RPC receipt before navigation. An uncertain response keeps the same key.
        try { storeCheckoutAttempt(completed); } catch { /* Pending key remains available for recovery. */ }
        setConfirmation(completed);
        try { completePurchase(pending.items, result.receipt.order_id); }
        catch { setError("Your order is confirmed, but cart storage could not be updated. Review your cart before ordering again."); }
        router.refresh();
      } catch {
        setError("The connection was interrupted. Your cart is safe. Retry the pending order; it will use the same checkout key.");
      } finally {
        submitting.current = false;
        setIsSubmitting(false);
      }
    });
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
        <section className="rounded-2xl bg-[#f5f0e6] p-6 sm:p-10">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-gold">Order confirmed</p>
          <h1 className="mt-2 text-4xl font-semibold text-forest-green">Thank you for your order</h1>
          <p className="mt-4 leading-7 text-muted">
            Your order number is <strong className="text-forest-green">{confirmation.receipt.order_number}</strong>.
          </p>
          {error && <p role="alert" className="mt-4 text-sm text-red-900">{error}</p>}
          <div className="mt-6 rounded-xl border border-black/10 bg-white/60 p-4 text-sm text-muted">
            <div className="flex justify-between gap-4">
              <span>Status</span>
              <span className="capitalize text-forest-green">{confirmation.receipt.status.replaceAll("_", " ")}</span>
            </div>
            <div className="mt-3 flex justify-between gap-4">
              <span>Total</span>
              <span className="font-semibold text-forest-green">${Number(confirmation.receipt.total).toFixed(2)}</span>
            </div>
          </div>
          <div className="mt-6 space-y-3 text-sm text-forest-green">
            <p>{confirmation.request.fulfillmentMethod === "delivery" ? "Delivery" : "Local pickup"} &middot; No online payment was collected at checkout.</p>
            <h2 className="font-semibold">Items ordered</h2>
            {confirmation.items.map((item) => <p key={item.productId}>{item.name} &times; {item.quantity}</p>)}
            <p className="text-muted">Keep your order number for reference. Your total above was confirmed by the store.</p>
          </div>
          <Link onClick={() => { forgetCheckoutAttempt(); }} className="mt-8 inline-flex rounded-lg bg-forest-green px-5 py-3 text-sm font-semibold text-white" href="/shop">
            Continue shopping
          </Link>
        </section>
      </main>
    );
  }

  if (!attempt && items.length === 0) {
    return <main className="mx-auto max-w-2xl px-5 py-20 text-center"><h1 className="text-3xl font-semibold text-forest-green">Your cart is empty</h1><p className="mt-4 text-muted">Add products before checking out.</p><Link className="mt-8 inline-flex rounded-lg bg-forest-green px-6 py-3 text-white" href="/shop">Browse the shop</Link></main>;
  }

  return (
    <main className="mx-auto w-full max-w-4xl px-5 py-10 lg:px-8">
      <SmartBackButton fallbackHref="/cart" fallbackLabel="Back to cart" />
      <div className="mt-8 rounded-2xl bg-[#f5f0e6] p-6 sm:p-10">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-gold">Secure checkout</p>
        <h1 className="mt-2 text-4xl font-semibold text-forest-green">Checkout</h1>
        <p className="mt-4 max-w-lg leading-7 text-muted">
          Choose pickup or delivery, then place your order. Payment will be collected separately.
        </p>
        {attempt && <div role="status" className="mt-6 space-y-2 rounded-xl border border-gold/40 bg-white p-4 text-sm break-words"><p>A previous order request is awaiting confirmation. Retry it below before starting another order. Your original items and details will be used.</p><p>{attempt.request.customerName} &middot; {attempt.request.customerEmail}</p><p>{attempt.request.fulfillmentMethod === "delivery" ? [attempt.request.address.address_line_1, attempt.request.address.city, attempt.request.address.country].filter(Boolean).join(", ") : "Local pickup"}</p></div>}
        <form className="mt-8 space-y-7" onSubmit={handleSubmit}>
          <fieldset disabled={isSubmitting || Boolean(attempt)} className="space-y-7">
          <fieldset className="space-y-4 border-t border-black/10 pt-6">
            <legend className="font-semibold text-forest-green">Your details</legend>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Full name" name="customerName" required />
              <Field label="Email address" name="customerEmail" required type="email" />
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

          {error ? (
            <p aria-live="polite" className="rounded-lg border border-red-900/15 bg-white/60 px-4 py-3 text-sm text-red-900">
              {error}
            </p>
          ) : null}

          <div className="rounded-xl bg-white/70 p-4 text-sm">
            <h2 className="font-semibold text-forest-green">Order summary</h2>
            {(attempt?.items ?? items).map((item) => <p className="mt-2" key={item.productId}>{item.name} &times; {item.quantity}</p>)}
            <p className="mt-3 text-muted">Final prices and availability are checked by the store when you place your order. No online payment is collected.</p>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-4 border-t border-black/10 pt-6">
            <div className="text-sm text-muted">
              <span className="font-semibold text-forest-green">
                {(attempt?.items ?? items).length} product{(attempt?.items ?? items).length === 1 ? "" : "s"}
              </span>
              {attempt ? " — awaiting confirmed total" : ` · $${subtotal.toFixed(2)} estimated subtotal`}
            </div>
            <button
              className="rounded-lg bg-forest-green px-5 py-3 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
              disabled={isSubmitting || (!attempt && items.length === 0)}
              type="submit"
            >
              {isSubmitting ? "Confirming order..." : attempt ? "Retry pending order" : "Place order"}
            </button>
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

function Field({ label, name, required = false, type = "text" }: { label: string; name: string; required?: boolean; type?: string }) {
  return (
    <label className="block text-sm font-medium">
      {label}
      <input className="mt-2 w-full rounded-lg border border-black/15 bg-white px-4 py-3" name={name} required={required} type={type} />
    </label>
  );
}
