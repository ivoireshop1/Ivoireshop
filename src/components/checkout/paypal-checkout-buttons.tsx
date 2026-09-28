"use client";

import { useEffect, useRef } from "react";
import type { PaymentEnvironment } from "@/src/lib/payments/public";

type PaypalButtons = {
  Buttons: (config: {
    createOrder: () => Promise<string>;
    onApprove: (data: { orderID: string }) => Promise<void>;
    onCancel: () => void;
    onError: () => void;
    style?: { layout?: string; color?: string; shape?: string; label?: string };
  }) => { render: (selector: string) => Promise<void> };
};

declare global {
  interface Window {
    paypal?: PaypalButtons;
  }
}

export function PaypalCheckoutButtons({
  clientId,
  environment,
  createOrder,
  onApprove,
  onCancel,
  onError,
}: {
  clientId: string;
  environment: PaymentEnvironment;
  createOrder: () => Promise<string>;
  onApprove: (orderId: string) => Promise<void>;
  onCancel: () => void;
  onError: () => void;
}) {
  const createRef = useRef(createOrder);
  const approveRef = useRef(onApprove);
  const cancelRef = useRef(onCancel);
  const errorRef = useRef(onError);

  useEffect(() => {
    createRef.current = createOrder;
    approveRef.current = onApprove;
    cancelRef.current = onCancel;
    errorRef.current = onError;
  }, [createOrder, onApprove, onCancel, onError]);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      await loadPaypalScript(clientId, environment);
      if (cancelled || !window.paypal) return;
      await window.paypal.Buttons({
        style: { layout: "vertical", color: "gold", shape: "rect", label: "paypal" },
        createOrder: () => createRef.current(),
        onApprove: (data) => approveRef.current(data.orderID),
        onCancel: () => cancelRef.current(),
        onError: () => errorRef.current(),
      }).render("#ivoire-paypal-buttons");
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [clientId, environment]);

  return <div className="min-h-[48px]" id="ivoire-paypal-buttons" />;
}

function loadPaypalScript(clientId: string, environment: PaymentEnvironment) {
  const src = `https://www.paypal.com/sdk/js?client-id=${encodeURIComponent(clientId)}&currency=USD&intent=capture${environment === "sandbox" ? "&debug=false" : ""}`;
  const existing = document.querySelector(`script[src="${src}"]`);
  if (existing) return Promise.resolve();
  return new Promise<void>((resolve, reject) => {
    const script = document.createElement("script");
    script.src = src;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("PayPal SDK failed to load."));
    document.head.appendChild(script);
  });
}
