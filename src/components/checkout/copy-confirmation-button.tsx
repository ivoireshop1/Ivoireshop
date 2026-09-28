"use client";

import { useState } from "react";

export function CopyConfirmationButton({ code }: { code: string }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      setCopied(false);
    }
  }

  return (
    <button
      className="rounded-lg border border-gold/50 bg-white px-4 py-2 text-sm font-semibold text-forest-green"
      onClick={copy}
      type="button"
    >
      {copied ? "Copied" : "Copy code"}
    </button>
  );
}
