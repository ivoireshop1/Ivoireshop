"use client";

import Link from "next/link";
import { useLiveNotifications } from "@/src/components/realtime/live-notifications-provider";

export function LiveToastHost() {
  const { toasts, dismissToast } = useLiveNotifications();
  if (!toasts.length) return null;
  return (
    <div className="pointer-events-none fixed bottom-4 left-3 right-3 z-[90] flex flex-col gap-2 md:left-auto md:right-4 md:w-[min(20rem,calc(100vw-1.5rem))]">
      {toasts.map((toast) => (
        <div className="pointer-events-auto rounded-2xl border border-forest-green/20 bg-white p-4 shadow-lg" key={toast.id}>
          <p className="text-sm font-semibold text-forest-green">{toast.title}</p>
          <p className="mt-1 line-clamp-3 whitespace-pre-line text-sm text-muted">{toast.message}</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {toast.href ? (
              <Link className="inline-flex min-h-11 items-center rounded-lg bg-forest-green px-3 text-sm font-semibold text-white" href={toast.href} onClick={() => dismissToast(toast.id)}>
                {toast.label || "View"}
              </Link>
            ) : null}
            <button className="inline-flex min-h-11 items-center px-2 text-sm font-semibold text-forest-green underline" onClick={() => dismissToast(toast.id)} type="button">
              Dismiss
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
