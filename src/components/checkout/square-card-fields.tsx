"use client";

import { useEffect, useRef, useState } from "react";
import { squareWebSdkUrl, type PaymentEnvironment } from "@/src/lib/payments/public";

type SquarePayments = {
  card: () => Promise<{
    attach: (selector: string) => Promise<void>;
    tokenize: () => Promise<{ status: string; token?: string }>;
  }>;
};

declare global {
  interface Window {
    Square?: {
      payments: (applicationId: string, locationId: string) => Promise<SquarePayments>;
    };
  }
}

export function SquareCardFields({
  applicationId,
  locationId,
  environment,
  onReady,
}: {
  applicationId: string;
  locationId: string;
  environment: PaymentEnvironment;
  onReady: (tokenize: () => Promise<string>) => void;
}) {
  const [error, setError] = useState("");
  const cardRef = useRef<{ tokenize: () => Promise<{ status: string; token?: string }> } | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        await loadSquareScript(environment);
        if (cancelled || !window.Square) throw new Error("Square failed to load.");
        const payments = await window.Square.payments(applicationId, locationId);
        const card = await payments.card();
        await card.attach("#ivoire-square-card");
        if (cancelled) return;
        cardRef.current = card;
        onReady(async () => {
          const result = await card.tokenize();
          if (result.status !== "OK" || !result.token) throw new Error("Enter valid card details to continue.");
          return result.token;
        });
      } catch {
        if (!cancelled) setError("Square card fields could not be loaded.");
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [applicationId, locationId, environment, onReady]);

  return (
    <div className="rounded-2xl border border-black/10 bg-white p-4">
      <p className="text-sm font-medium text-forest-green">Card details</p>
      <div className="mt-3 min-h-[90px]" id="ivoire-square-card" />
      {error ? <p className="mt-3 text-sm text-red-900">{error}</p> : null}
    </div>
  );
}

function loadSquareScript(environment: PaymentEnvironment) {
  const src = squareWebSdkUrl(environment);
  const existing = document.querySelector(`script[src="${src}"]`);
  if (existing) return Promise.resolve();
  return new Promise<void>((resolve, reject) => {
    const script = document.createElement("script");
    script.src = src;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Square SDK failed to load."));
    document.head.appendChild(script);
  });
}
