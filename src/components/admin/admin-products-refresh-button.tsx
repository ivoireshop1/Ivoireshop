"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { refreshAdminProductsList } from "@/src/lib/catalog/admin-actions";

export function AdminProductsRefreshButton() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const refreshing = busy || isPending;

  async function handleRefresh() {
    if (refreshing) return;
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const result = await refreshAdminProductsList();
      if (!result.success) {
        setError("Couldn\u2019t refresh products. Try again.");
        return;
      }
      startTransition(() => {
        router.refresh();
      });
      setMessage("Products refreshed");
    } catch (caught) {
      const digest =
        typeof caught === "object" && caught && "digest" in caught
          ? String((caught as { digest?: string }).digest)
          : "";
      if (digest.startsWith("NEXT_REDIRECT")) throw caught;
      setError("Couldn\u2019t refresh products. Try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex min-w-0 flex-col gap-1">
      <button
        aria-busy={refreshing}
        aria-label="Refresh"
        className="inline-flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-full border border-[#173f35]/10 bg-white px-4 py-2 text-sm font-medium text-[#173f35] shadow-sm transition hover:border-[#173f35]/20 disabled:cursor-not-allowed disabled:opacity-60"
        disabled={refreshing}
        onClick={() => void handleRefresh()}
        type="button"
      >
        {refreshing ? (
          <>
            <span
              aria-hidden
              className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-[#173f35]/20 border-t-[#173f35]"
            />
            Refreshing...
          </>
        ) : (
          "Refresh"
        )}
      </button>
      {error ? (
        <p className="max-w-[16rem] text-xs leading-5 text-[#7f1d1d]" role="alert">
          {error}
        </p>
      ) : null}
      {message && !error ? (
        <p className="max-w-[16rem] text-xs leading-5 text-[#173f35]" role="status">
          {message}
        </p>
      ) : null}
    </div>
  );
}
