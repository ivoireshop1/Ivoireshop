"use client";

import { useState, useTransition } from "react";
import { closeStore, openStore } from "@/src/lib/store/actions";

export function StoreStatusControl({ isOpen }: { isOpen: boolean }) {
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function toggle() {
    setError(null);
    if (isOpen) {
      const confirmed = window.confirm("Close the store? Customers can still browse, but new orders will be blocked until you reopen.");
      if (!confirmed) return;
      startTransition(async () => {
        const result = await closeStore();
        if (!result.success) setError(result.error);
      });
      return;
    }
    startTransition(async () => {
      const result = await openStore();
      if (!result.success) setError(result.error);
    });
  }

  return (
    <div className="mt-4">
      <button
        className="min-h-11 rounded-xl bg-[#173f35] px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-60"
        disabled={pending}
        onClick={toggle}
        type="button"
      >
        {pending ? "Updating..." : isOpen ? "Close store" : "Open store"}
      </button>
      {error ? <p className="mt-2 text-sm text-[#7f1d1d]">{error}</p> : null}
    </div>
  );
}
