"use client";

import Link from "next/link";
import Image from "next/image";
import { useCallback, useEffect, useState, useTransition, type FormEvent } from "react";
import {
  clearGuestOrderRefsOnDevice,
  forgetGuestOrderToken,
  guestOrderTokens,
  loadGuestOrderRefs,
  rememberGuestOrderToken,
} from "@/src/lib/checkout/guest-order-storage";
import { loadGuestOrdersByTokens, requestGuestOrderEmailRecovery } from "@/src/lib/checkout/guest-order-actions";
import {
  partitionGuestOrders,
  type GuestOrderListItem,
} from "@/src/lib/checkout/guest-order-lifecycle";
import { orderStatusLabel, paymentStatusLabel } from "@/src/lib/orders/status";
import { fulfillmentDisplay } from "@/src/lib/delivery/labels";
import { formatStoreDate } from "@/src/lib/store/timezone";
import { isNextImageSrc } from "@/src/lib/catalog/image-url";
import { isCarrierOrder, officialTrackLabel, trackingUrl } from "@/src/lib/delivery/tracking";

function GuestOrderCard({
  order,
  onRemoveFromDevice,
}: {
  order: GuestOrderListItem;
  onRemoveFromDevice: (token: string) => void;
}) {
  const trackHref =
    isCarrierOrder(order.fulfillmentProvider) && order.trackingNumber
      ? trackingUrl(order.fulfillmentProvider ?? "", order.trackingNumber)
      : "";
  const itemPreview = order.items.map((item) => `${item.product_name} ×${item.quantity}`).join(", ");

  return (
    <article className="rounded-[24px] border border-forest-green/10 bg-[#f7f3ee] p-5">
      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-gold">Guest order</p>
      <div className="mt-2 flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="font-mono text-lg tracking-[0.14em] text-forest-green">{order.confirmationCode || order.orderNumber}</p>
          <p className="mt-1 text-sm text-muted">{formatStoreDate(order.createdAt)}</p>
        </div>
        <div className="text-right">
          <p className="font-semibold text-forest-green">${Number(order.total).toFixed(2)}</p>
          <p className="mt-1 text-xs font-semibold uppercase tracking-wide text-gold">
            {orderStatusLabel(order.status, order.fulfillmentMethod, order.fulfillmentProvider)}
          </p>
        </div>
      </div>
      <p className="mt-3 text-sm text-forest-green">
        {fulfillmentDisplay({
          fulfillment_method: order.fulfillmentMethod,
          fulfillment_provider: order.fulfillmentProvider,
          fulfillment_service: order.fulfillmentService,
        })}
      </p>
      <p className="mt-1 text-sm text-muted">{paymentStatusLabel(order.paymentStatus, order.paymentProvider)}</p>
      {itemPreview ? <p className="mt-3 text-sm text-muted">{itemPreview}</p> : null}
      {order.items.length ? (
        <div className="mt-3 flex gap-2">
          {order.items.slice(0, 4).map((item, index) => (
            <span className="relative h-12 w-12 overflow-hidden rounded-lg bg-[#eadfce]" key={`${item.product_name}-${index}`}>
              {item.image_url && isNextImageSrc(item.image_url) ? (
                <Image alt="" className="object-cover" fill sizes="48px" src={item.image_url} unoptimized />
              ) : (
                <span className="flex h-full items-center justify-center text-[9px] font-semibold uppercase tracking-wide text-forest-green">Ivoire</span>
              )}
            </span>
          ))}
        </div>
      ) : null}
      {order.trackingNumber ? (
        <p className="mt-3 break-all text-sm text-forest-green">
          Tracking: <span className="font-mono">{order.trackingNumber}</span>
        </p>
      ) : null}
      <div className="mt-4 flex flex-wrap items-center gap-3">
        <Link
          className="min-h-11 rounded-lg bg-forest-green px-4 py-2 text-sm font-semibold text-white"
          href={`/order/confirm/${order.token}`}
          referrerPolicy="no-referrer"
        >
          View order
        </Link>
        {trackHref ? (
          <a
            className="min-h-11 rounded-lg border border-forest-green/20 px-4 py-2 text-sm font-semibold text-forest-green"
            href={trackHref}
            rel="noreferrer"
            target="_blank"
          >
            {officialTrackLabel(order.fulfillmentProvider)}
          </a>
        ) : null}
        <button
          className="min-h-11 text-sm text-muted underline-offset-2 hover:underline"
          onClick={() => onRemoveFromDevice(order.token)}
          type="button"
        >
          Remove from this device
        </button>
      </div>
    </article>
  );
}

export function GuestOrderTracker({ emailConfigured: initialEmailConfigured = false }: { emailConfigured?: boolean }) {
  const [orders, setOrders] = useState<GuestOrderListItem[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [recoveryEmail, setRecoveryEmail] = useState("");
  const [recoveryMessage, setRecoveryMessage] = useState<string | null>(null);
  const [emailConfigured, setEmailConfigured] = useState(initialEmailConfigured);
  const [pending, startTransition] = useTransition();

  const refresh = useCallback(() => {
    const tokens = guestOrderTokens();
    if (!tokens.length) {
      setOrders([]);
      setLoaded(true);
      setError(null);
      return;
    }
    startTransition(async () => {
      try {
        const result = await loadGuestOrdersByTokens(tokens);
        setOrders(result.orders);
        // Drop unverifiable tokens from this device so dead refs do not linger.
        const ok = new Set(result.orders.map((order) => order.token));
        for (const ref of loadGuestOrderRefs()) {
          if (!ok.has(ref.t)) forgetGuestOrderToken(ref.t);
        }
        setError(null);
      } catch {
        setError("We could not refresh your orders. Try again in a moment.");
      } finally {
        setLoaded(true);
      }
    });
  }, []);

  useEffect(() => {
    refresh();
    const onFocus = () => refresh();
    window.addEventListener("focus", onFocus);
    const timer = window.setInterval(refresh, 45_000);
    return () => {
      window.removeEventListener("focus", onFocus);
      window.clearInterval(timer);
    };
  }, [refresh]);

  const { active, past } = partitionGuestOrders(orders);

  function removeFromDevice(token: string) {
    forgetGuestOrderToken(token);
    setOrders((current) => current.filter((order) => order.token !== token));
  }

  function clearDevice() {
    clearGuestOrderRefsOnDevice();
    setOrders([]);
    setRecoveryMessage("Orders were cleared from this browser. Your purchase records remain with the store.");
  }

  function submitRecovery(event: FormEvent) {
    event.preventDefault();
    setRecoveryMessage(null);
    startTransition(async () => {
      const result = await requestGuestOrderEmailRecovery(recoveryEmail);
      setEmailConfigured(result.emailConfigured);
      setRecoveryMessage(result.message);
    });
  }

  return (
    <div className="space-y-10">
      <header className="rounded-[28px] bg-[#f5f0e6] p-6 sm:p-8">
        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-gold">Guest checkout</p>
        <h1 className="mt-3 text-3xl font-semibold text-forest-green sm:text-4xl">Track My Order</h1>
        <p className="mt-3 max-w-2xl text-sm leading-7 text-muted">
          Orders placed as a guest on this device stay available here after refresh or restart — no account required.
          We never show orders from an email or order number alone.
        </p>
        <div className="mt-5 flex flex-wrap gap-3">
          <button
            className="min-h-11 rounded-lg border border-forest-green/20 px-4 py-2 text-sm font-semibold text-forest-green disabled:opacity-50"
            disabled={pending}
            onClick={() => refresh()}
            type="button"
          >
            {pending ? "Refreshing…" : "Refresh status"}
          </button>
          {orders.length ? (
            <button
              className="min-h-11 rounded-lg px-4 py-2 text-sm text-muted underline-offset-2 hover:underline"
              onClick={clearDevice}
              type="button"
            >
              Clear orders from this device
            </button>
          ) : null}
        </div>
        {error ? <p className="mt-4 text-sm text-red-900" role="alert">{error}</p> : null}
      </header>

      <section aria-labelledby="active-guest-orders">
        <h2 className="text-xl font-semibold text-forest-green" id="active-guest-orders">
          Active orders
        </h2>
        {!loaded ? (
          <p className="mt-4 text-sm text-muted" role="status">Loading orders saved on this device…</p>
        ) : active.length === 0 ? (
          <p className="mt-4 text-sm text-muted">
            No active guest orders on this device. Place an order as a guest, or recover from another device below.
          </p>
        ) : (
          <div className="mt-4 grid gap-4">
            {active.map((order) => (
              <GuestOrderCard key={order.token} onRemoveFromDevice={removeFromDevice} order={order} />
            ))}
          </div>
        )}
      </section>

      <section aria-labelledby="past-guest-orders">
        <h2 className="text-xl font-semibold text-forest-green" id="past-guest-orders">
          Past orders
        </h2>
        <p className="mt-2 text-sm text-muted">Completed or cancelled orders stay listed here on this device. Store records are not deleted.</p>
        {past.length === 0 ? (
          <p className="mt-4 text-sm text-muted">No past guest orders on this device yet.</p>
        ) : (
          <div className="mt-4 grid gap-4">
            {past.map((order) => (
              <GuestOrderCard key={order.token} onRemoveFromDevice={removeFromDevice} order={order} />
            ))}
          </div>
        )}
      </section>

      <section aria-labelledby="guest-order-recovery" className="rounded-[24px] border border-black/10 bg-white p-6">
        <h2 className="text-xl font-semibold text-forest-green" id="guest-order-recovery">
          Different device?
        </h2>
        <p className="mt-2 text-sm leading-7 text-muted">
          {emailConfigured
            ? "Enter the email used at checkout. We only send secure links to that inbox — we never display order details from an unverified email."
            : "Email recovery will send secure links once transactional email is configured. Until then, open your original confirmation link on this device to restore access."}
        </p>
        <form className="mt-5 flex flex-col gap-3 sm:flex-row" onSubmit={submitRecovery}>
          <label className="sr-only" htmlFor="guest-recovery-email">Email used at checkout</label>
          <input
            autoComplete="email"
            className="min-h-11 flex-1 rounded-lg border border-forest-green/20 px-3 text-sm"
            id="guest-recovery-email"
            inputMode="email"
            onChange={(event) => setRecoveryEmail(event.target.value)}
            placeholder="Email used at checkout"
            required
            type="email"
            value={recoveryEmail}
          />
          <button
            className="min-h-11 rounded-lg bg-forest-green px-5 text-sm font-semibold text-white disabled:opacity-50"
            disabled={pending}
            type="submit"
          >
            {pending ? "Sending…" : "Send recovery link"}
          </button>
        </form>
        {recoveryMessage ? (
          <p className="mt-4 text-sm text-forest-green" role="status">{recoveryMessage}</p>
        ) : null}
        <p className="mt-4 text-xs leading-6 text-muted">
          Shared device tip: use “Clear orders from this device” when you leave a public computer. Opening a recovery or confirmation link on this browser saves access here via{" "}
          <button
            className="underline underline-offset-2"
            onClick={() => {
              const path = window.location.pathname;
              if (path.startsWith("/order/confirm/")) {
                const token = path.split("/").pop() || "";
                rememberGuestOrderToken(token);
                refresh();
              }
            }}
            type="button"
          >
            secure token storage
          </button>
          — never order numbers alone.
        </p>
      </section>
    </div>
  );
}
