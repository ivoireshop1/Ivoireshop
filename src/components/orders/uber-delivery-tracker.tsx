"use client";

import { useEffect, useState } from "react";
import { refreshCustomerUberDelivery, type UberProgress } from "@/src/lib/delivery/uber-actions";
import { UBER_CUSTOMER_STAGES } from "@/src/lib/delivery/uber-status";

export function UberDeliveryTracker({
  orderId,
  guestToken,
  initial,
}: {
  orderId: string;
  guestToken?: string;
  initial: UberProgress | null;
}) {
  const [progress, setProgress] = useState(initial);
  useEffect(() => {
    let stopped = false;
    async function pull() {
      const next = await refreshCustomerUberDelivery({ orderId, guestToken });
      if (!stopped && next) setProgress(next);
    }
    const timer = window.setInterval(pull, 15000);
    return () => {
      stopped = true;
      window.clearInterval(timer);
    };
  }, [orderId, guestToken]);
  const stage = progress?.stage ?? "accepted";
  const currentIndex = UBER_CUSTOMER_STAGES.findIndex((item) => item.id === stage);
  return (
    <section className="mt-6 rounded-2xl border border-[#173f35]/15 bg-white p-5">
      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#b8964c]">Local Delivery — Powered by Uber</p>
      <h2 className="mt-2 font-semibold text-[#173f35]">Delivery progress</h2>
      {stage === "cancelled" || stage === "failed" ? (
        <p className="mt-3 text-sm text-[#7c5d1a]">{progress?.lastError || (stage === "cancelled" ? "This delivery was cancelled." : "This delivery could not be completed.")}</p>
      ) : (
        <ol className="mt-4 space-y-2">
          {UBER_CUSTOMER_STAGES.map((item, index) => {
            const done = currentIndex > index;
            const current = currentIndex === index;
            return (
              <li className={`rounded-xl px-3 py-2 text-sm ${current ? "bg-[#173f35] text-white" : done ? "bg-[#f3efe9] text-[#173f35]" : "text-[#6b6b6b]"}`} key={item.id}>
                {item.label}
              </li>
            );
          })}
        </ol>
      )}
      {progress?.trackingUrl ? <a className="mt-4 inline-flex min-h-11 items-center text-sm font-semibold text-[#173f35] underline" href={progress.trackingUrl} rel="noreferrer" target="_blank">Track with Uber</a> : null}
      {progress?.courierName ? <p className="mt-3 text-sm text-[#173f35]">Courier: {progress.courierName}{progress.courierVehicle ? ` · ${progress.courierVehicle}` : ""}{progress.courierPhone ? ` · ${progress.courierPhone}` : ""}</p> : null}
    </section>
  );
}
