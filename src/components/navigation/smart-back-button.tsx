"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { getBackButtonLabel, getStoredPreviousPath, hasUsableBrowserHistory, sanitizeReturnPath, type SmartBackButtonProps } from "@/src/lib/navigation/smart-navigation";

export function SmartBackButton({ fallbackHref = "/shop", fallbackLabel = "Browse products" }: SmartBackButtonProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const explicitReturn = searchParams.get("returnTo");
  const [referrerPath, setReferrerPath] = useState<string | null>(null);
  const [storedPath, setStoredPath] = useState<string | null>(null);
  const [canGoBack, setCanGoBack] = useState(false);

  useEffect(() => {
    if (explicitReturn) return;

    const currentPath = `${pathname}${searchParams.toString() ? `?${searchParams.toString()}` : ""}`;
    const previousPath = getStoredPreviousPath(currentPath, fallbackHref);
    if (previousPath !== fallbackHref) {
      const timer = window.setTimeout(() => setStoredPath(previousPath), 0);
      return () => window.clearTimeout(timer);
    }

    const browserHistoryAvailable = hasUsableBrowserHistory();
    if (browserHistoryAvailable) {
      const timer = window.setTimeout(() => setCanGoBack(true), 0);
      return () => window.clearTimeout(timer);
    }

    const referrer = document.referrer;
    if (referrer) {
      try {
        const referrerUrl = new URL(referrer);
        if (referrerUrl.origin === window.location.origin && referrerUrl.pathname !== pathname) {
          const safeReferrer = sanitizeReturnPath(`${referrerUrl.pathname}${referrerUrl.search}`, fallbackHref);
          const timer = window.setTimeout(() => setReferrerPath(safeReferrer), 0);
          return () => window.clearTimeout(timer);
        }
      } catch {
        return;
      }
    }
  }, [explicitReturn, fallbackHref, pathname, searchParams]);

  const returnPath = explicitReturn ? sanitizeReturnPath(explicitReturn, fallbackHref) : storedPath ?? referrerPath ?? fallbackHref;
  const usesBrowserHistory = !explicitReturn && !storedPath && !referrerPath && canGoBack;
  const isFallback = returnPath === fallbackHref && !usesBrowserHistory;
  const label = usesBrowserHistory ? "Go back" : isFallback ? fallbackLabel : getBackButtonLabel(returnPath, "Go back");

  return <button aria-label={label} className="inline-flex min-h-10 items-center rounded-lg px-3 py-2 text-sm font-medium text-forest-green transition hover:bg-forest-green/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-gold" onClick={() => usesBrowserHistory ? router.back() : router.push(returnPath)} type="button"><span aria-hidden="true" className="mr-2 text-lg">←</span>{label}</button>;
}
