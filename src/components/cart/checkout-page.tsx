"use client";

import Link from "next/link";
import { FormEvent, useRef, useState } from "react";
import { SmartBackButton } from "@/src/components/navigation/smart-back-button";
import { useCart } from "@/src/lib/cart/cart-context";
import { createClient } from "@/src/lib/supabase/browser";
import { FulfillmentMethodCards } from "@/src/components/checkout/fulfillment-method-cards";
import { useFulfillmentMethod } from "@/src/lib/fulfillment/use-fulfillment-method";

type CheckoutResult = { order_id: string; order_number: string; status: string; total: number | string };

export function CheckoutPage() {
  const { items, subtotal, isLoaded, clearCart } = useCart();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [confirmation, setConfirmation] = useState<CheckoutResult | null>(null);
  const [fulfillmentMethod] = useFulfillmentMethod();
  const idempotencyKeyRef = useRef<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isSubmitting || confirmation) return;
    const form = new FormData(event.currentTarget);
    const value = (name: string) => String(form.get(name) ?? "").trim();
    const customerName = value("customerName");
    const customerEmail = value("customerEmail");
    const customerPhone = value("customerPhone");
    const addressLine1 = value("addressLine1");
    const city = value("city");
    const country = value("country");

    if (!items.length) {
      setError("Your cart is empty. Add an item before checking out.");
      return;
    }
    if (!customerName || !customerEmail || !customerPhone) {
      setError("Please provide your name, email address, and phone number.");
      return;
    }
    if (fulfillmentMethod === "delivery" && (!addressLine1 || !city || !country)) {
      setError("Please complete your shipping address.");
      return;
    }

    setError("");
    setIsSubmitting(true);
    idempotencyKeyRef.current ??= crypto.randomUUID();
    const { data, error: rpcError } = await createClient().rpc("create_checkout_order", {
      p_items: items.map(({ productId, quantity }) => ({ product_id: productId, quantity })),
      p_customer_name: customerName,
      p_customer_email: customerEmail,
      p_customer_phone: customerPhone,
      p_shipping_address: fulfillmentMethod === "delivery"
        ? {
            address_line_1: addressLine1,
            address_line_2: value("addressLine2") || null,
            city,
            state: value("state") || null,
            postal_code: value("postalCode") || null,
            country,
          }
        : { fulfillment_method: "local_pickup" },
      p_fulfillment_method: fulfillmentMethod,
      p_idempotency_key: idempotencyKeyRef.current,
    });
    setIsSubmitting(false);
    const result = Array.isArray(data) ? (data[0] as CheckoutResult | undefined) : undefined;
    if (rpcError || !result?.order_id || !result.order_number) {
      setError("We couldn’t place your order right now. Your cart and details have been kept so you can try again.");
      return;
    }
    setConfirmation(result);
    clearCart();
  }

  if (!isLoaded) {
    return (
      <main className="mx-auto w-full max-w-4xl px-5 py-16 lg:px-8">
        <p className="text-muted">Loading checkout...</p>
      </main>
    );
  }

  if (confirmation) {
    return (
      <main className="mx-auto w-full max-w-4xl px-5 py-10 lg:px-8">
        <section className="rounded-2xl bg-[#f5f0e6] p-6 sm:p-10">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-gold">Order confirmed</p>
          <h1 className="mt-2 text-4xl font-semibold text-forest-green">Thank you for your order</h1>
          <p className="mt-4 leading-7 text-muted">
            Your order number is <strong className="text-forest-green">{confirmation.order_number}</strong>.
          </p>
          <div className="mt-6 rounded-xl border border-black/10 bg-white/60 p-4 text-sm text-muted">
            <div className="flex justify-between gap-4">
              <span>Status</span>
              <span className="capitalize text-forest-green">{confirmation.status.replaceAll("_", " ")}</span>
            </div>
            <div className="mt-3 flex justify-between gap-4">
              <span>Total</span>
              <span className="font-semibold text-forest-green">${Number(confirmation.total).toFixed(2)}</span>
            </div>
          </div>
          <Link className="mt-8 inline-flex rounded-lg bg-forest-green px-5 py-3 text-sm font-semibold text-white" href="/shop">
            Continue shopping
          </Link>
        </section>
      </main>
    );
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
        <form className="mt-8 space-y-7" onSubmit={handleSubmit}>
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

          {error ? (
            <p aria-live="polite" className="rounded-lg border border-red-900/15 bg-white/60 px-4 py-3 text-sm text-red-900">
              {error}
            </p>
          ) : null}

          <div className="flex flex-wrap items-center justify-between gap-4 border-t border-black/10 pt-6">
            <div className="text-sm text-muted">
              <span className="font-semibold text-forest-green">
                {items.length} product{items.length === 1 ? "" : "s"}
              </span>
              {" "}· ${subtotal.toFixed(2)} subtotal
            </div>
            <button
              className="rounded-lg bg-forest-green px-5 py-3 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
              disabled={isSubmitting || items.length === 0}
              type="submit"
            >
              {isSubmitting ? "Placing order..." : "Place order"}
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
