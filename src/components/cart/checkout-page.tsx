"use client";

import Link from "next/link";
import { FormEvent, useEffect, useRef, useState } from "react";
import { SmartBackButton } from "@/src/components/navigation/smart-back-button";
import { useCart } from "@/src/lib/cart/cart-context";
import { useRouter } from "next/navigation";
import { validateCheckout, type CheckoutReceipt } from "@/src/lib/checkout/checkout-validation";
import {
  readCheckoutAttempt,
  storeCheckoutAttempt,
  readCheckoutDraft,
  storeCheckoutDraft,
  forgetCheckoutDraft,
  forgetCheckoutProgress,
  type CheckoutAttempt,
  type CheckoutStep,
} from "@/src/lib/checkout/checkout-session";
import { STORE_CLOSED_MESSAGE } from "@/src/lib/store/constants";
import { CheckoutProgress } from "@/src/components/checkout/checkout-progress";
import { CheckoutShippingMethods } from "@/src/components/checkout/checkout-shipping-methods";
import { CheckoutOrderSummary } from "@/src/components/checkout/checkout-order-summary";
import { useFulfillmentMethod } from "@/src/lib/fulfillment/use-fulfillment-method";
import { PaymentMethodCards } from "@/src/components/checkout/payment-method-cards";
import { StripeCheckoutForm } from "@/src/components/checkout/stripe-checkout-form";
import { OrderConfirmationExperience } from "@/src/components/checkout/order-confirmation-experience";
import { getCheckoutDeliveryOptions, getCheckoutLiveCarrierOptions } from "@/src/lib/delivery/actions";
import type { DeliveryOption } from "@/src/lib/delivery/types";
import { taxDisplayLabel, type TaxLine, type TaxSettings } from "@/src/lib/tax/totals";
import { viewOrderHref } from "@/src/lib/checkout/view-order-href";
import { confirmStripeTestPayment, prepareStripePayment } from "@/src/lib/payments/stripe-actions";
import { placeDemoOrder } from "@/src/lib/payments/demo-actions";
import type { PublicPaymentConfig } from "@/src/lib/payments/readiness";
import type { StoreOrigin } from "@/src/lib/delivery/origin";
import { PickupLocationBlock } from "@/src/components/store/pickup-location-block";
import { liveIdentityFromOptionId, liveServiceKey, liveServiceKeyFromOptionId } from "@/src/lib/shipping/shippo";

function markCheckout(step: string, detail?: Record<string, unknown>) {
  const payload = { t: performance.now(), step, ...detail };
  console.info("[checkout-timing]", payload);
  try {
    performance.mark(`checkout:${step}`);
  } catch {
    /* ignore unsupported marks */
  }
}

function isLiveOptionId(id: string) {
  return id.includes(":live:");
}

function liveCarrierFromOptionId(id: string): "ups" | "usps" | null {
  if (id.startsWith("ups:")) return "ups";
  if (id.startsWith("usps:")) return "usps";
  return null;
}

/** Fingerprint of destination + cart — only this changing should force a new Shippo quote. */
function checkoutQuoteFingerprint(
  address: { addressLine1: string; city: string; state: string; postalCode: string; country: string },
  items: Array<{ productId: string; quantity: number }>,
) {
  const cart = items
    .map((item) => `${item.productId}:${Number(item.quantity)}`)
    .sort()
    .join("|");
  return [
    address.addressLine1.trim().toLowerCase(),
    address.city.trim().toLowerCase(),
    address.state.trim().toUpperCase(),
    address.postalCode.trim(),
    address.country.trim().toUpperCase(),
    cart,
  ].join("::");
}

function placeholderLiveOption(id: string, amount: number): DeliveryOption | null {
  const provider = liveCarrierFromOptionId(id);
  if (!provider || !Number.isFinite(amount)) return null;
  const service = id.split(":")[2] || "service";
  return {
    id,
    provider,
    fulfillmentMethod: "delivery",
    label: `${provider.toUpperCase()} · selected rate`,
    amount,
    serviceCode: service,
    serviceToken: service,
    estimate: "Saved selection — revalidated at payment",
    mode: "api",
    rateMode: "live_api",
    testRate: true,
  };
}

export function CheckoutPage({ storeOpen, payments, pickupOrigin = null, demoEnabled = false }: { storeOpen: boolean; payments: PublicPaymentConfig; pickupOrigin?: StoreOrigin | null; demoEnabled?: boolean }) {
  const { items, subtotal, isLoaded, completePurchase } = useCart();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [confirmation, setConfirmation] = useState<CheckoutAttempt | null>(null);
  const [emailSent, setEmailSent] = useState(false);
  const [fulfillmentMethod, setFulfillmentMethod] = useFulfillmentMethod();
  const [deliveryOptionId, setDeliveryOptionId] = useState("");
  const [checkoutStep, setCheckoutStep] = useState<CheckoutStep>("account");
  const [contact, setContact] = useState({ customerName: "", customerEmail: "", customerPhone: "" });
  const [address, setAddress] = useState({ addressLine1: "", addressLine2: "", city: "", state: "", postalCode: "", country: "US" });
  const [options, setOptions] = useState<DeliveryOption[]>([]);
  const [breakdowns, setBreakdowns] = useState<Record<string, { shipping: number; tax: number; total: number; taxLines?: TaxLine[] }>>({});
  const [quoteSubtotal, setQuoteSubtotal] = useState<number | null>(null);
  const [taxSettings, setTaxSettings] = useState<TaxSettings | null>(null);
  const [livePickupOrigin, setLivePickupOrigin] = useState<StoreOrigin | null>(pickupOrigin);
  const [quoteBusy, setQuoteBusy] = useState(false);
  const [liveQuoteBusy, setLiveQuoteBusy] = useState(false);
  const [quoteMessage, setQuoteMessage] = useState("");
  const [expectedLiveCarriers, setExpectedLiveCarriers] = useState<Array<"ups" | "usps">>([]);
  const [attempt, setAttempt] = useState<CheckoutAttempt | null>(null);
  const [sessionReady, setSessionReady] = useState(false);
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [publishableKey, setPublishableKey] = useState<string | null>(null);
  const baseQuoteSeq = useRef(0);
  const liveQuoteSeq = useRef(0);
  const stepStartedAt = useRef(0);
  const prepareLock = useRef(false);
  const idempotencyKeyRef = useRef<string | null>(null);
  const resumeTried = useRef(false);
  const selectedLiveAmountRef = useRef<number | null>(null);
  const deliveryOptionIdRef = useRef("");
  /** Pinned live selection — survives rate-limited refreshes until cart/destination changes. */
  const pinnedLiveOptionRef = useRef<DeliveryOption | null>(null);
  const pinnedLiveBreakdownRef = useRef<{ shipping: number; tax: number; total: number; taxLines?: TaxLine[] } | null>(null);
  const pinnedQuoteFingerprintRef = useRef<string>("");
  const lastLiveQuoteFingerprintRef = useRef<string>("");
  const inFlightLiveFingerprintRef = useRef<string | null>(null);
  const [temporaryBusyCarriers, setTemporaryBusyCarriers] = useState<Array<"ups" | "usps">>([]);
  const [paymentMethod, setPaymentMethod] = useState<"demo" | "stripe" | "">(demoEnabled ? "demo" : "");
  const recovered = useRef(false);
  const router = useRouter();

  useEffect(() => {
    deliveryOptionIdRef.current = deliveryOptionId;
  }, [deliveryOptionId]);

  function pinLiveSelection(option: DeliveryOption, breakdown?: { shipping: number; tax: number; total: number; taxLines?: TaxLine[] } | null) {
    if (option.rateMode !== "live_api") return;
    pinnedLiveOptionRef.current = option;
    pinnedLiveBreakdownRef.current = breakdown ?? {
      shipping: option.amount,
      tax: 0,
      total: option.amount,
    };
    pinnedQuoteFingerprintRef.current = checkoutQuoteFingerprint(address, items);
    selectedLiveAmountRef.current = option.amount;
    // Cancel in-flight Shippo refreshes so a late 10429 response cannot erase this selection.
    liveQuoteSeq.current += 1;
    inFlightLiveFingerprintRef.current = null;
    setLiveQuoteBusy(false);
  }

  function clearPinnedLiveSelection() {
    pinnedLiveOptionRef.current = null;
    pinnedLiveBreakdownRef.current = null;
    pinnedQuoteFingerprintRef.current = "";
  }

  function mergePinnedLiveOptions(list: DeliveryOption[]) {
    const pinned = pinnedLiveOptionRef.current;
    if (!pinned) return list;
    const fingerprint = checkoutQuoteFingerprint(address, items);
    if (pinnedQuoteFingerprintRef.current && pinnedQuoteFingerprintRef.current !== fingerprint) {
      clearPinnedLiveSelection();
      return list;
    }
    const hasPinned = list.some((option) => (
      option.id === pinned.id
      || (option.rateMode === "live_api" && liveServiceKey(option) === liveServiceKey(pinned))
    ));
    return hasPinned ? list : [...list, pinned];
  }

  useEffect(() => {
    stepStartedAt.current = performance.now();
    markCheckout("checkout:mounted");
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
      const draft = readCheckoutDraft();
      if (saved?.receipt?.payment_status === "paid" || saved?.receipt?.payment_status === "demo" || saved?.receipt?.is_demo) {
        setConfirmation(saved);
        setEmailSent(saved.receipt.email_sent === true);
        forgetCheckoutDraft();
      } else if (saved) {
        setAttempt(saved);
        idempotencyKeyRef.current = saved.request.idempotencyKey;
        setContact({
          customerName: saved.request.customerName,
          customerEmail: saved.request.customerEmail,
          customerPhone: saved.request.customerPhone ?? "",
        });
        setAddress({
          addressLine1: saved.request.address.address_line_1 ?? "",
          addressLine2: saved.request.address.address_line_2 ?? "",
          city: saved.request.address.city ?? "",
          state: saved.request.address.state ?? "",
          postalCode: saved.request.address.postal_code ?? "",
          country: saved.request.address.country || "US",
        });
        setFulfillmentMethod(saved.request.fulfillmentMethod);
        setDeliveryOptionId(saved.request.deliveryOptionId ?? "");
        if (typeof saved.request.quotedShipping === "number" && Number.isFinite(saved.request.quotedShipping)) {
          selectedLiveAmountRef.current = saved.request.quotedShipping;
          const placeholder = saved.request.deliveryOptionId
            ? placeholderLiveOption(saved.request.deliveryOptionId, saved.request.quotedShipping)
            : null;
          if (placeholder) {
            pinnedLiveOptionRef.current = placeholder;
            pinnedLiveBreakdownRef.current = {
              shipping: saved.request.quotedShipping,
              tax: 0,
              total: saved.request.quotedShipping,
            };
            pinnedQuoteFingerprintRef.current = checkoutQuoteFingerprint(
              {
                addressLine1: saved.request.address.address_line_1 ?? "",
                city: saved.request.address.city ?? "",
                state: saved.request.address.state ?? "",
                postalCode: saved.request.address.postal_code ?? "",
                country: saved.request.address.country || "US",
              },
              saved.request.items.map((item) => ({ productId: item.product_id, quantity: item.quantity })),
            );
            lastLiveQuoteFingerprintRef.current = pinnedQuoteFingerprintRef.current;
            setOptions((current) => (current.some((row) => row.id === placeholder.id) ? current : [...current, placeholder]));
            if (pinnedLiveBreakdownRef.current) {
              setBreakdowns((current) => ({ ...current, [placeholder.id]: pinnedLiveBreakdownRef.current! }));
            }
          }
        }
        const step = saved.step ?? (saved.receipt ? "payment" : draft?.step) ?? "account";
        setCheckoutStep(step === "review" ? "payment" : step);
        if (saved.receipt || step === "payment" || step === "review") {
          setPaymentMethod(demoEnabled ? "demo" : payments.stripeReady ? "stripe" : "");
        }
      } else if (draft) {
        setContact(draft.contact);
        setAddress(draft.address);
        setFulfillmentMethod(draft.fulfillmentMethod);
        setDeliveryOptionId(draft.deliveryOptionId);
        if (typeof draft.quotedShipping === "number" && Number.isFinite(draft.quotedShipping)) {
          selectedLiveAmountRef.current = draft.quotedShipping;
          const placeholder = draft.deliveryOptionId
            ? placeholderLiveOption(draft.deliveryOptionId, draft.quotedShipping)
            : null;
          if (placeholder) {
            pinnedLiveOptionRef.current = placeholder;
            pinnedLiveBreakdownRef.current = {
              shipping: draft.quotedShipping,
              tax: 0,
              total: draft.quotedShipping,
            };
            pinnedQuoteFingerprintRef.current = checkoutQuoteFingerprint(
              draft.address,
              items.map(({ productId, quantity }) => ({ productId, quantity })),
            );
            lastLiveQuoteFingerprintRef.current = pinnedQuoteFingerprintRef.current;
            setOptions((current) => (current.some((row) => row.id === placeholder.id) ? current : [...current, placeholder]));
            setBreakdowns((current) => ({ ...current, [placeholder.id]: pinnedLiveBreakdownRef.current! }));
          }
        }
        setCheckoutStep(draft.step === "payment" || draft.step === "review" ? "shipping" : draft.step);
      }
      setSessionReady(true);
    }, 0);
    return () => window.clearTimeout(timer);
  }, [demoEnabled, payments.stripeReady, setFulfillmentMethod]);

  // Persist non-sensitive checkout progress for refresh / back-forward (never card data).
  useEffect(() => {
    if (!sessionReady || confirmation) return;
    const timer = window.setTimeout(() => {
      try {
        storeCheckoutDraft({
          step: checkoutStep,
          contact,
          address,
          fulfillmentMethod,
          deliveryOptionId,
          quotedShipping: resolveSelectedOption()?.amount ?? selectedLiveAmountRef.current ?? undefined,
        });
      } catch {
        /* sessionStorage optional */
      }
    }, 250);
    return () => window.clearTimeout(timer);
    // resolveSelectedOption reads options/deliveryOptionId from the latest render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionReady, confirmation, checkoutStep, contact, address, fulfillmentMethod, deliveryOptionId, options]);

  // Fast path: pickup / store / Ivoire — never waits on Shippo. Debounced on address edits.
  // Freeze quotes on Payment/Review so a background refresh cannot invalidate a selected UPS rate.
  useEffect(() => {
    if (checkoutStep === "payment" || checkoutStep === "review") {
      // Invalidate in-flight base quotes started on Shipping so late responses cannot rewrite options.
      baseQuoteSeq.current += 1;
      setQuoteBusy(false);
      return;
    }
    const seq = ++baseQuoteSeq.current;
    const timer = window.setTimeout(() => {
      const started = performance.now();
      const cartItems = items.map(({ productId, quantity }) => ({ product_id: productId, quantity }));
      setQuoteBusy(true);
      markCheckout("base-quote:start", { seq });
      void getCheckoutDeliveryOptions({
        address: {
          address_line_1: address.addressLine1,
          city: address.city,
          state: address.state,
          postal_code: address.postalCode,
          country: address.country,
        },
        items: cartItems,
        includeLiveCarriers: false,
      }).then((result) => {
        if (seq !== baseQuoteSeq.current) return;
        markCheckout("base-quote:done", { seq, ms: Math.round(performance.now() - started), options: result.options.length });
        setOptions((current) => {
          const liveKeep = current.filter((option) => option.rateMode === "live_api");
          return mergePinnedLiveOptions([
            ...result.options.filter((option) => option.rateMode !== "live_api"),
            ...liveKeep,
          ]);
        });
        setBreakdowns((current) => {
          const next: typeof current = { ...(result.breakdowns ?? {}) };
          for (const [id, row] of Object.entries(current)) {
            if (isLiveOptionId(id)) next[id] = row;
          }
          const pinnedId = pinnedLiveOptionRef.current?.id;
          if (pinnedId && pinnedLiveBreakdownRef.current) next[pinnedId] = pinnedLiveBreakdownRef.current;
          return next;
        });
        setQuoteSubtotal(result.subtotal ?? null);
        setTaxSettings(result.tax ?? null);
        if (result.origin) setLivePickupOrigin(result.origin);
        setExpectedLiveCarriers(Array.isArray(result.expectedLiveCarriers) ? result.expectedLiveCarriers : []);
        setDeliveryOptionId((current) => {
          if (current && (result.options.some((option) => option.id === current) || isLiveOptionId(current) || current.includes(":manual:"))) {
            return current;
          }
          // Never auto-select away from a pinned UPS/USPS rate.
          if (current && pinnedLiveOptionRef.current && isLiveOptionId(current)) return current;
          const next = result.options[0];
          if (next) setFulfillmentMethod(next.fulfillmentMethod);
          return next?.id ?? "";
        });
        setQuoteBusy(false);
      }).catch(() => {
        if (seq === baseQuoteSeq.current) {
          setQuoteBusy(false);
          setQuoteMessage((current) => current || "Delivery options could not be refreshed. Your entered details were kept — try again in a moment.");
        }
      });
    }, 200);
    return () => window.clearTimeout(timer);
  }, [checkoutStep, address.addressLine1, address.city, address.state, address.postalCode, address.country, items, setFulfillmentMethod]);

  // Slow path: debounced Shippo UPS/USPS. After a valid live selection for this fingerprint, do not re-quote.
  useEffect(() => {
    if (checkoutStep === "payment" || checkoutStep === "review") {
      liveQuoteSeq.current += 1;
      setLiveQuoteBusy(false);
      return;
    }
    const destReady = Boolean(
      address.addressLine1.trim()
      && address.city.trim()
      && address.postalCode.trim().length >= 5
      && address.country.trim(),
    );
    if (!destReady || !items.length) {
      setLiveQuoteBusy(false);
      return;
    }
    const fingerprint = checkoutQuoteFingerprint(address, items);
    // Invalidate pin when cart/destination changes.
    if (pinnedQuoteFingerprintRef.current && pinnedQuoteFingerprintRef.current !== fingerprint) {
      clearPinnedLiveSelection();
      lastLiveQuoteFingerprintRef.current = "";
      setTemporaryBusyCarriers([]);
    }
    const hasPinnedForFingerprint = Boolean(
      pinnedLiveOptionRef.current
      && pinnedQuoteFingerprintRef.current === fingerprint,
    );
    // Stop unnecessary Shippo traffic after a valid UPS/USPS selection for this quote context.
    if (hasPinnedForFingerprint && isLiveOptionId(deliveryOptionIdRef.current)) {
      setLiveQuoteBusy(false);
      setOptions((current) => mergePinnedLiveOptions(current));
      markCheckout("live-quote:skip-pinned", { fingerprint });
      return;
    }
    // Deduplicate identical in-flight requests (address field churn while one Shippo call runs).
    if (inFlightLiveFingerprintRef.current === fingerprint) {
      markCheckout("live-quote:skip-inflight", { fingerprint });
      return;
    }

    const seq = ++liveQuoteSeq.current;
    const timer = window.setTimeout(() => {
      if (inFlightLiveFingerprintRef.current === fingerprint) return;
      const started = performance.now();
      const cartItems = items.map(({ productId, quantity }) => ({ product_id: productId, quantity }));
      inFlightLiveFingerprintRef.current = fingerprint;
      setLiveQuoteBusy(true);
      markCheckout("live-quote:start", { seq, fingerprint });
      void getCheckoutLiveCarrierOptions({
        address: {
          address_line_1: address.addressLine1,
          city: address.city,
          state: address.state,
          postal_code: address.postalCode,
          country: address.country,
        },
        items: cartItems,
      }).then((live) => {
        if (seq === liveQuoteSeq.current) inFlightLiveFingerprintRef.current = null;
        if (seq !== liveQuoteSeq.current) return;
        markCheckout("live-quote:done", {
          seq,
          ms: Math.round(performance.now() - started),
          rates: live.options.length,
          temporaryBusy: live.temporaryBusy === true,
        });
        lastLiveQuoteFingerprintRef.current = fingerprint;
        setExpectedLiveCarriers(live.expectedLiveCarriers ?? []);
        const busyCarriers = live.rateLimitedCarriers ?? (live.temporaryBusy ? (["ups", "usps"] as const).filter((c) => (live.expectedLiveCarriers ?? []).includes(c)) : []);
        setTemporaryBusyCarriers([...busyCarriers]);

        const currentId = deliveryOptionIdRef.current;
        const selectedCarrier = liveCarrierFromOptionId(currentId);
        const previous = selectedLiveAmountRef.current
          ?? pinnedLiveOptionRef.current?.amount
          ?? null;

        setOptions((current) => {
          const base = current.filter((option) => option.rateMode !== "live_api");
          const keepPinned = pinnedLiveOptionRef.current
            && selectedCarrier
            && !live.options.some((option) => option.provider === selectedCarrier)
            ? [pinnedLiveOptionRef.current]
            : [];
          const keepSelected = selectedCarrier
            && !live.options.some((option) => option.provider === selectedCarrier)
            && !keepPinned.length
            ? current.filter((option) => option.id === currentId && option.rateMode === "live_api")
            : [];
          return mergePinnedLiveOptions([...base, ...live.options, ...keepPinned, ...keepSelected]);
        });

        if (live.breakdowns) {
          setBreakdowns((current) => {
            const next = { ...current };
            for (const key of Object.keys(next)) {
              if (!isLiveOptionId(key)) continue;
              const pinnedId = pinnedLiveOptionRef.current?.id;
              if (pinnedId && key === pinnedId && busyCarriers.length) continue;
              if (selectedCarrier && key === currentId && !live.options.some((option) => option.provider === selectedCarrier)) continue;
              delete next[key];
            }
            const merged = { ...next, ...live.breakdowns };
            if (pinnedLiveOptionRef.current?.id && pinnedLiveBreakdownRef.current) {
              merged[pinnedLiveOptionRef.current.id] = pinnedLiveBreakdownRef.current;
            }
            return merged;
          });
        }

        if (!currentId || !isLiveOptionId(currentId)) {
          setQuoteMessage(live.message ?? "");
        } else {
          const carrierRates = live.options.filter((option) => option.provider === selectedCarrier);
          if (!carrierRates.length) {
            // Temporary busy / omitted carrier: keep pin — never mark as expired Unavailable.
            setQuoteMessage(
              live.temporaryBusy
                ? (live.message || "Carrier rates are temporarily busy. Your selected rate is kept.")
                : (live.message || "Live carrier rates could not refresh this carrier. Your selected rate is kept."),
            );
            if (pinnedLiveOptionRef.current) {
              setOptions((current) => mergePinnedLiveOptions(current));
            }
          } else {
            setTemporaryBusyCarriers((current) => current.filter((carrier) => carrier !== selectedCarrier));
            const exact = carrierRates.find((option) => option.id === currentId);
            const byIdentity = carrierRates.filter((option) => liveIdentityFromOptionId(option.id) === liveIdentityFromOptionId(currentId));
            const byService = carrierRates.filter((option) => liveServiceKey(option) === liveServiceKeyFromOptionId(currentId));
            const priced = (candidates: typeof carrierRates) => (
              previous == null
                ? candidates
                : candidates.filter((option) => Math.abs(option.amount - previous) < 0.015)
            );
            const byPrice = previous == null
              ? []
              : carrierRates.filter((option) => Math.abs(option.amount - previous) < 0.015);
            const rematched = exact
              ? exact
              : priced(byIdentity).length === 1
                ? priced(byIdentity)[0]
                : byIdentity.length === 1
                  ? byIdentity[0]
                  : priced(byService).length === 1
                    ? priced(byService)[0]
                    : byService.length === 1
                      ? byService[0]
                      : byPrice.length === 1
                        ? byPrice[0]
                        : null;
            if (rematched) {
              if (previous != null && Math.abs(rematched.amount - previous) >= 0.015) {
                setQuoteMessage(`Shipping price updated from $${previous.toFixed(2)} to $${rematched.amount.toFixed(2)}. Confirm the new amount before paying.`);
              } else {
                setQuoteMessage(live.message ?? "");
              }
              pinLiveSelection(rematched, live.breakdowns?.[rematched.id] ?? null);
              if (rematched.id !== currentId) setDeliveryOptionId(rematched.id);
            } else {
              // Genuine absence of the selected service among returned carrier rates.
              clearPinnedLiveSelection();
              selectedLiveAmountRef.current = null;
              setQuoteMessage("Your selected shipping service is no longer available for this address and package. Your cart and address were kept — choose another method.");
              setDeliveryOptionId("");
            }
          }
        }
        setLiveQuoteBusy(false);
      }).catch(() => {
        if (seq === liveQuoteSeq.current) {
          inFlightLiveFingerprintRef.current = null;
          setLiveQuoteBusy(false);
          setTemporaryBusyCarriers((current) => {
            const pinned = liveCarrierFromOptionId(deliveryOptionIdRef.current);
            return pinned && !current.includes(pinned) ? [...current, pinned] : current;
          });
          setOptions((current) => mergePinnedLiveOptions(current));
          setQuoteMessage("Live carrier rates could not be refreshed. Your selected rate is kept when available — Pickup and store options remain.");
        }
      });
    }, 800);
    return () => {
      window.clearTimeout(timer);
    };
  }, [checkoutStep, address.addressLine1, address.city, address.state, address.postalCode, address.country, items]);

  function resolveSelectedOption() {
    return options.find((option) => option.id === deliveryOptionId)
      ?? (isLiveOptionId(deliveryOptionId)
        ? options.find((option) => option.rateMode === "live_api" && liveIdentityFromOptionId(option.id) === liveIdentityFromOptionId(deliveryOptionId))
          ?? options.find((option) => option.rateMode === "live_api" && liveServiceKey(option) === liveServiceKeyFromOptionId(deliveryOptionId))
          ?? (pinnedLiveOptionRef.current && (
            pinnedLiveOptionRef.current.id === deliveryOptionId
            || liveServiceKey(pinnedLiveOptionRef.current) === liveServiceKeyFromOptionId(deliveryOptionId)
          ) ? pinnedLiveOptionRef.current : null)
          ?? null
        : null);
  }

  function withReceipt(current: CheckoutAttempt, receipt: CheckoutReceipt): CheckoutAttempt {
    return {
      ...current,
      step: "payment",
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

  function buildCandidate() {
    const idempotencyKey = attempt?.request.idempotencyKey
      ?? idempotencyKeyRef.current
      ?? crypto.randomUUID();
    idempotencyKeyRef.current = idempotencyKey;
    const selected = resolveSelectedOption();
    const quotedShipping = selected?.amount
      ?? selectedLiveAmountRef.current
      ?? attempt?.request.quotedShipping
      ?? undefined;
    if (selected?.rateMode === "live_api") selectedLiveAmountRef.current = selected.amount;
    return {
      items: items.map(({ productId, quantity }) => ({ product_id: productId, quantity })),
      customerName: contact.customerName,
      customerEmail: contact.customerEmail,
      customerPhone: contact.customerPhone,
      address: { address_line_1: address.addressLine1, address_line_2: address.addressLine2, city: address.city, state: address.state, postal_code: address.postalCode, country: address.country },
      fulfillmentMethod,
      deliveryOptionId: selected?.id || deliveryOptionId || (fulfillmentMethod === "local_pickup" ? "pickup" : "store"),
      quotedShipping,
      idempotencyKey,
    };
  }

  function showConfirmed(next: CheckoutAttempt, sent: boolean) {
    persist({ ...next, receipt: { ...next.receipt!, email_sent: sent } });
    forgetCheckoutDraft();
    setEmailSent(sent);
    setConfirmation({ ...next, receipt: { ...next.receipt!, email_sent: sent } });
    try { completePurchase(next.items, next.receipt!.order_id); }
    catch { setError("Your order is confirmed, but cart storage could not be updated. Review your cart before ordering again."); }
    router.refresh();
  }

  async function startStripe(expectedTotal: number | null) {
    if (prepareLock.current) return false;
    prepareLock.current = true;
    setIsSubmitting(true);
    try {
      const candidate = buildCandidate();
      const validated = validateCheckout(candidate);
      if (validated.error) { setError(validated.error); return false; }
      const request = {
        ...validated.request!,
        idempotencyKey: attempt?.request.idempotencyKey ?? idempotencyKeyRef.current ?? validated.request!.idempotencyKey,
      };
      idempotencyKeyRef.current = request.idempotencyKey;
      const pending: CheckoutAttempt = {
        request,
        items: attempt?.items ?? items.map(({ productId, name, quantity, price, image, sellingMethod, sellingUnit }) => ({
          productId, name, quantity, price, image, sellingMethod, sellingUnit,
        })),
        createdAt: attempt?.createdAt ?? Date.now(),
        receipt: attempt?.receipt,
        step: "payment",
      };
      try { storeCheckoutAttempt(pending); }
      catch { setError("Enable browser session storage before placing an order so retries can be recovered safely."); return false; }
      setAttempt(pending);
      setError("");
      const prepared = await prepareStripePayment({ checkout: pending.request, expectedTotal });
      if (!prepared.success) {
        if (prepared.alreadyPaid && prepared.receipt) {
          showConfirmed(withReceipt(pending, prepared.receipt), prepared.receipt.email_sent === true);
          return true;
        }
        setError(prepared.error);
        setClientSecret(null);
        if (prepared.totalsChanged) {
          if (prepared.total != null) setQuoteSubtotal(prepared.subtotal ?? null);
          if (prepared.shipping != null) selectedLiveAmountRef.current = prepared.shipping;
          const busy = /briefly busy|too many requests|10429/i.test(prepared.error || "");
          setQuoteMessage(
            prepared.shipping != null
              ? `Shipping is now $${prepared.shipping.toFixed(2)} (order total $${(prepared.total ?? 0).toFixed(2)}). Confirm the updated rate before paying.`
              : (prepared.error || "Totals were updated. Review the new amount before paying."),
          );
          // Rate-limit / transient carrier busy: stay on Payment so retry uses the same idempotency key.
          if (!busy) setCheckoutStep("shipping");
        }
        return false;
      }
      const next = withReceipt(pending, prepared.receipt);
      persist(next);
      setAttempt(next);
      setClientSecret(prepared.clientSecret);
      setPublishableKey(prepared.publishableKey);
      if (prepared.subtotal != null) setQuoteSubtotal(prepared.subtotal);
      return true;
    } catch {
      setError("Payment could not be prepared. Your details were kept — try again. You will not be charged twice.");
      setClientSecret(null);
      return false;
    } finally {
      setIsSubmitting(false);
      prepareLock.current = false;
    }
  }

  // Resume unpaid PaymentIntent after refresh — same idempotency key, never a new charge path.
  useEffect(() => {
    if (!sessionReady || resumeTried.current || confirmation || demoEnabled) return;
    if (!attempt?.receipt || attempt.receipt.payment_status === "paid" || attempt.receipt.is_demo) return;
    if (!payments.stripeReady || clientSecret) return;
    resumeTried.current = true;
    setPaymentMethod("stripe");
    setCheckoutStep("payment");
    void startStripe(attempt.receipt.total ?? null).then((ok) => {
      markCheckout("stripe:resume-done", { ok });
    });
    // intentionally once on restore
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionReady, attempt?.receipt?.order_id, payments.stripeReady, demoEnabled, confirmation, clientSecret]);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
  }

  if (!isLoaded || !sessionReady) {
    return (
      <main className="mx-auto w-full max-w-4xl overflow-x-hidden px-5 py-10 lg:px-8">
        <SmartBackButton fallbackHref="/cart" fallbackLabel="Back to cart" />
        <div className="mt-8 min-w-0 rounded-2xl bg-[#f5f0e6] p-4 sm:p-10">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-gold">Secure checkout</p>
          <h1 className="mt-2 text-4xl font-semibold text-forest-green">Checkout</h1>
          <p className="mt-4 text-muted" role="status">Loading your checkout…</p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link className="text-sm font-semibold text-forest-green underline underline-offset-4" href="/cart">Back to cart</Link>
            <Link className="text-sm font-semibold text-forest-green underline underline-offset-4" href="/shop">Continue shopping</Link>
          </div>
        </div>
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
          onContinue={() => { forgetCheckoutProgress(); }}
        />
      </main>
    );
  }

  if (!attempt && items.length === 0) {
    return <main className="mx-auto max-w-2xl px-5 py-20 text-center"><h1 className="text-3xl font-semibold text-forest-green">Your cart is empty</h1><p className="mt-4 text-muted">Add products before checking out.</p><Link className="mt-8 inline-flex rounded-lg bg-forest-green px-6 py-3 text-white" href="/shop">Browse the shop</Link></main>;
  }

  const selectedOption = resolveSelectedOption();
  const breakdown = selectedOption ? breakdowns[selectedOption.id] : undefined;
  const summaryItems = attempt?.items ?? items;
  const displaySubtotal = attempt?.receipt?.subtotal ?? quoteSubtotal ?? subtotal;
  const displayShipping = attempt?.receipt?.shipping_cost ?? breakdown?.shipping ?? null;
  const displayTax = attempt?.receipt?.tax_amount ?? breakdown?.tax ?? null;
  const displayTotal = attempt?.receipt?.total ?? breakdown?.total ?? null;
  const taxLabel = taxSettings ? taxDisplayLabel(taxSettings) : "Tax";

  async function submitDemoOrder(expectedTotal: number | null) {
    if (prepareLock.current || isSubmitting) return;
    prepareLock.current = true;
    setIsSubmitting(true);
    try {
      const candidate = buildCandidate();
      const validated = validateCheckout(candidate);
      if (validated.error) { setError(validated.error); return; }
      const pending: CheckoutAttempt = attempt ?? {
        request: validated.request!,
        items: items.map(({ productId, name, quantity, price, image, sellingMethod, sellingUnit }) => ({
          productId, name, quantity, price, image, sellingMethod, sellingUnit,
        })),
        createdAt: Date.now(),
        step: "payment",
      };
      try { storeCheckoutAttempt(pending); }
      catch { setError("Enable browser session storage before placing an order so retries can be recovered safely."); return; }
      setAttempt(pending);
      const placed = await placeDemoOrder({ checkout: pending.request, expectedTotal });
      if (!placed.success) {
        setError(placed.error);
        return;
      }
      showConfirmed(withReceipt(pending, placed.receipt), false);
    } finally {
      setIsSubmitting(false);
      prepareLock.current = false;
    }
  }

  function goShipping() {
    if (!contact.customerName || !contact.customerEmail || !contact.customerPhone) {
      setError("Enter a valid name, email address, and phone number.");
      return;
    }
    setError("");
    markCheckout("step:account->shipping", { ms: Math.round(performance.now() - stepStartedAt.current) });
    stepStartedAt.current = performance.now();
    setCheckoutStep("shipping");
  }

  function goPayment() {
    if (isSubmitting || prepareLock.current) return;
    if (!deliveryOptionId || !selectedOption) {
      setError("Choose a shipping method.");
      return;
    }
    if (selectedOption.rateMode === "live_api" && liveQuoteBusy && !pinnedLiveOptionRef.current) {
      setError("Live carrier rates are still updating. Wait a moment or choose Pickup / store shipping.");
      return;
    }
    if (selectedOption.fulfillmentMethod === "delivery" && (!address.addressLine1 || !address.city || !address.country)) {
      setError("Complete your delivery address, city, and country.");
      return;
    }
    // Freeze the selected live amount before PaymentIntent prepare / any late rematch.
    if (selectedOption.rateMode === "live_api") {
      pinLiveSelection(selectedOption, breakdowns[selectedOption.id] ?? null);
      if (selectedOption.id !== deliveryOptionId) setDeliveryOptionId(selectedOption.id);
    }
    setError("");
    markCheckout("step:shipping->payment", {
      ms: Math.round(performance.now() - stepStartedAt.current),
      provider: selectedOption.provider,
      liveBusy: liveQuoteBusy,
      quotedShipping: selectedOption.amount,
    });
    stepStartedAt.current = performance.now();
    // Show Payment immediately — do not wait for Stripe PaymentIntent creation.
    setCheckoutStep("payment");
    if (demoEnabled) {
      setPaymentMethod("demo");
      setClientSecret(null);
      setPublishableKey(null);
      return;
    }
    if (!payments.stripeReady) {
      setPaymentMethod("");
      setClientSecret(null);
      setPublishableKey(null);
      return;
    }
    setPaymentMethod("stripe");
    void startStripe(displayTotal).then((ok) => {
      markCheckout("stripe:prepare-done", { ok, ms: Math.round(performance.now() - stepStartedAt.current) });
    });
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
            ? (demoEnabled
              ? "Demonstration checkout. No card is collected and no real payment is charged."
              : "Enter your details, choose how you want to receive your order, then pay.")
            : STORE_CLOSED_MESSAGE}
        </p>
        {attempt?.receipt && attempt.receipt.payment_status !== "paid" && attempt.receipt.payment_status !== "demo" && !clientSecret ? (
          <div role="status" className="mt-6 space-y-3 rounded-xl border border-gold/40 bg-white p-4 text-sm break-words">
            <p>A previous order is waiting for payment. Continue below, or start a new checkout if this is a different order.</p>
            <p>{attempt.request.customerName} &middot; {attempt.request.customerEmail}</p>
            <p>{attempt.receipt.order_number ? `Order ${attempt.receipt.order_number}` : "Unpaid checkout"}</p>
            <button
              className="text-sm font-semibold text-forest-green underline"
              onClick={() => {
                forgetCheckoutProgress();
                setAttempt(null);
                setClientSecret(null);
                setPublishableKey(null);
                idempotencyKeyRef.current = null;
                resumeTried.current = false;
                setError("");
                setPaymentMethod(demoEnabled ? "demo" : "");
                setCheckoutStep("account");
              }}
              type="button"
            >
              Start a new checkout
            </button>
          </div>
        ) : null}
        <form aria-describedby={error ? "checkout-error" : undefined} className="mt-8 space-y-7" onSubmit={handleSubmit}>
          <fieldset className="space-y-4" disabled={isSubmitting} hidden={checkoutStep !== "account"}>
            <legend className="font-semibold text-forest-green">Your details</legend>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field hint="We'll send your receipt and pickup/delivery updates here." label="Email address" name="customerEmail" onChange={(value) => setContact((current) => ({ ...current, customerEmail: value }))} type="email" value={contact.customerEmail} />
              <Field label="Full name" name="customerName" onChange={(value) => setContact((current) => ({ ...current, customerName: value }))} value={contact.customerName} />
            </div>
            <Field label="Phone number" name="customerPhone" onChange={(value) => setContact((current) => ({ ...current, customerPhone: value }))} type="tel" value={contact.customerPhone} />
            <button className="min-h-12 w-full rounded-xl bg-forest-green px-4 text-sm font-semibold text-white disabled:opacity-60" disabled={isSubmitting} onClick={goShipping} type="button">Continue to Shipping →</button>
          </fieldset>

          <fieldset className="min-w-0 space-y-6" disabled={isSubmitting} hidden={checkoutStep !== "shipping"}>
            {selectedOption?.fulfillmentMethod === "local_pickup" ? (
              <>
                <p className="rounded-xl border border-forest-green/10 bg-white/60 px-4 py-3 text-sm text-muted">We’ll have your groceries ready for pickup. A destination is still needed below if you want UPS or USPS rates.</p>
                <PickupLocationBlock className="rounded-xl border border-forest-green/10 bg-white px-4 py-3" location={livePickupOrigin} />
              </>
            ) : null}
            <div className="space-y-4">
              <h2 className="font-semibold text-forest-green">Shipping destination</h2>
              <Field label="Address line 1" name="addressLine1" onChange={(value) => setAddress((current) => ({ ...current, addressLine1: value }))} value={address.addressLine1} />
              <Field label="Address line 2 (optional)" name="addressLine2" onChange={(value) => setAddress((current) => ({ ...current, addressLine2: value }))} value={address.addressLine2} />
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="City" name="city" onChange={(value) => setAddress((current) => ({ ...current, city: value }))} value={address.city} />
                <Field label="State / region" name="state" onChange={(value) => setAddress((current) => ({ ...current, state: value }))} value={address.state} />
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="ZIP / postal code" name="postalCode" onChange={(value) => setAddress((current) => ({ ...current, postalCode: value }))} value={address.postalCode} />
                <Field label="Country" name="country" onChange={(value) => setAddress((current) => ({ ...current, country: value }))} value={address.country} />
              </div>
            </div>
            <CheckoutShippingMethods
              busy={quoteBusy && options.filter((option) => option.rateMode !== "live_api").length === 0}
              expectedLiveCarriers={expectedLiveCarriers}
              message={quoteMessage}
              options={options}
              pickupOrigin={livePickupOrigin}
              temporaryBusyCarriers={temporaryBusyCarriers}
              value={deliveryOptionId}
              onChange={(option) => {
                setDeliveryOptionId(option.id);
                setFulfillmentMethod(option.fulfillmentMethod);
                if (option.rateMode === "live_api") {
                  pinLiveSelection(option, breakdowns[option.id] ?? null);
                  setTemporaryBusyCarriers((current) => current.filter((carrier) => carrier !== option.provider));
                } else {
                  clearPinnedLiveSelection();
                  selectedLiveAmountRef.current = null;
                }
                setQuoteMessage("");
              }}
            />
            {liveQuoteBusy && !(pinnedLiveOptionRef.current && isLiveOptionId(deliveryOptionId)) ? (
              <p className="text-sm text-muted" role="status" aria-live="polite">
                Updating UPS/USPS rates… Pickup and store options are ready now.
              </p>
            ) : null}
            <CheckoutOrderSummary
              continueDisabled={!storeOpen || !deliveryOptionId || isSubmitting || (selectedOption?.rateMode === "live_api" && liveQuoteBusy && !pinnedLiveOptionRef.current)}
              continueLabel="Continue to Payment →"
              items={summaryItems}
              provider={selectedOption?.provider}
              shipping={displayShipping}
              subtotal={displaySubtotal}
              tax={displayTax}
              taxLabel={taxLabel}
              taxLines={breakdown?.taxLines}
              taxMode={taxSettings?.tax_mode}
              total={displayTotal}
              onContinue={goPayment}
            />
            <button className="text-sm font-semibold text-forest-green underline" onClick={() => setCheckoutStep("account")} type="button">Back to account</button>
          </fieldset>

          <fieldset className="min-w-0 space-y-4" disabled={isSubmitting} hidden={checkoutStep !== "payment" && checkoutStep !== "review"}>
            <legend className="font-semibold text-forest-green">Payment</legend>
            {demoEnabled || !payments.stripeReady ? null : (
              <PaymentMethodCards
                demoEnabled={demoEnabled}
                method={paymentMethod}
                stripeReady={payments.stripeReady}
                onChange={(next) => {
                  if (isSubmitting || prepareLock.current) return;
                  setPaymentMethod(next);
                  setError("");
                  if (next === "stripe") void startStripe(displayTotal);
                  else {
                    setClientSecret(null);
                    setPublishableKey(null);
                  }
                }}
              />
            )}
            {demoEnabled || !payments.stripeReady || !payments.stripeTestMode ? null : (
              <div className="space-y-3 rounded-xl border border-[#b8964c]/40 bg-white px-4 py-3 text-sm text-[#7c5d1a]">
                <p>TEST MODE. Pay with a test card. This is not a live charge.</p>
                {paymentMethod === "stripe" && attempt?.receipt && clientSecret ? (
                  <button
                    className="min-h-11 w-full rounded-xl border border-[#7c5d1a]/30 bg-[#f8f1df] px-4 text-sm font-semibold text-[#7c5d1a] disabled:opacity-60"
                    disabled={!storeOpen || isSubmitting}
                    onClick={() => {
                      if (isSubmitting) return;
                      void (async () => {
                        setIsSubmitting(true);
                        setError("");
                        const confirmed = await confirmStripeTestPayment(attempt.request.idempotencyKey);
                        setIsSubmitting(false);
                        if (!confirmed.success) {
                          if (confirmed.alreadyPaid && confirmed.receipt) {
                            showConfirmed(withReceipt(attempt, confirmed.receipt), confirmed.receipt.email_sent === true);
                            return;
                          }
                          setError(confirmed.error);
                          return;
                        }
                        showConfirmed(withReceipt(attempt, confirmed.receipt), confirmed.receipt.email_sent === true);
                      })();
                    }}
                    type="button"
                  >
                    {isSubmitting ? "Confirming test payment…" : "Complete Stripe TEST charge (Visa 4242)"}
                  </button>
                ) : null}
              </div>
            )}
            {!demoEnabled && !payments.stripeReady ? (
              <p className="rounded-xl border border-[#173f35]/15 bg-white px-4 py-3 text-sm text-[#173f35]">
                {payments.paymentUnavailableMessage}
              </p>
            ) : null}
            <CheckoutOrderSummary
              continueLabel="Total due"
              items={summaryItems}
              provider={selectedOption?.provider}
              shipping={displayShipping}
              showContinue={false}
              subtotal={displaySubtotal}
              tax={displayTax}
              taxLabel={taxLabel}
              taxLines={breakdown?.taxLines}
              taxMode={taxSettings?.tax_mode}
              total={displayTotal}
            />
            {paymentMethod === "demo" ? (
              <div className="space-y-3">
                <p className="rounded-xl border border-[#b8964c]/40 bg-white px-4 py-3 text-sm text-[#7c5d1a]">Demo Payment — No real charge. This order will be labeled as a demonstration.</p>
                <button
                  className="min-h-12 w-full rounded-xl bg-forest-green px-4 text-sm font-semibold text-white disabled:opacity-60"
                  disabled={!storeOpen || isSubmitting}
                  onClick={() => void submitDemoOrder(displayTotal)}
                  type="button"
                >
                  {isSubmitting ? "Placing demo order…" : "Place Demo Order"}
                </button>
              </div>
            ) : null}
            {demoEnabled || !payments.stripeReady ? null : paymentMethod === "stripe" && clientSecret && publishableKey && attempt ? (
              <StripeCheckoutForm
                amountLabel={displayTotal != null ? `$${displayTotal.toFixed(2)}` : ""}
                clientSecret={clientSecret}
                disabled={!storeOpen || isSubmitting}
                idempotencyKey={attempt.request.idempotencyKey}
                publishableKey={publishableKey}
                onError={setError}
                onPaid={(receipt) => showConfirmed(withReceipt(attempt, receipt), receipt.email_sent === true)}
              />
            ) : paymentMethod === "stripe" && payments.stripeReady && isSubmitting ? (
              <p className="text-sm text-muted" role="status">Preparing secure payment…</p>
            ) : paymentMethod === "stripe" && payments.stripeReady ? (
              <div className="space-y-3">
                {error ? <p className="text-sm text-muted">Card payment could not start. You can try again without creating a duplicate order.</p> : null}
                <button
                  className="min-h-12 w-full rounded-xl bg-forest-green px-4 text-sm font-semibold text-white disabled:opacity-60"
                  disabled={!storeOpen || isSubmitting}
                  onClick={() => void startStripe(displayTotal)}
                  type="button"
                >
                  Continue with card
                </button>
              </div>
            ) : paymentMethod === "demo" || (!demoEnabled && !payments.stripeReady) ? null : paymentMethod ? null : (
              <p className="text-sm text-muted">Select a payment method.</p>
            )}
            <button className="text-sm font-semibold text-forest-green underline" disabled={isSubmitting} onClick={() => setCheckoutStep("shipping")} type="button">Back to shipping</button>
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
