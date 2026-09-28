"use client";

import { useEffect, useRef, useState } from "react";

export function CopyConfirmationButton({ code }: { code: string }) {
  const [copied, setCopied] = useState(false);
  const timer = useRef<number | null>(null);

  useEffect(() => () => {
    if (timer.current) window.clearTimeout(timer.current);
  }, []);

  async function copy() {
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(code);
      } else {
        throw new Error("clipboard");
      }
    } catch {
      const input = document.createElement("textarea");
      input.value = code;
      input.setAttribute("readonly", "true");
      input.style.position = "fixed";
      input.style.opacity = "0";
      document.body.appendChild(input);
      input.select();
      const ok = document.execCommand("copy");
      input.remove();
      if (!ok) return;
    }
    setCopied(true);
    if (timer.current) window.clearTimeout(timer.current);
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    timer.current = window.setTimeout(() => setCopied(false), reduced ? 1200 : 1800);
  }

  return (
    <button
      aria-label={copied ? "Confirmation code copied" : "Copy confirmation code"}
      className="min-h-11 rounded-lg border border-gold/50 bg-white px-4 py-2 text-sm font-semibold text-forest-green"
      onClick={copy}
      type="button"
    >
      <span aria-live="polite">{copied ? "Copied!" : "Copy Code"}</span>
    </button>
  );
}
