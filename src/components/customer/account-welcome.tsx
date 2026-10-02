"use client";

import { useEffect, useRef, useState } from "react";
import { playIvoireTone } from "@/src/lib/audio/ivoire-tones";
import { markWelcomeComplete } from "@/src/lib/customer/preferences";

export function AccountWelcome({ enabled }: { enabled: boolean }) {
  const [visible, setVisible] = useState(enabled);
  const finished = useRef(false);

  useEffect(() => {
    if (!enabled) return;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const duration = reduced ? 400 : 2400;
    const audioTimer = window.setTimeout(() => {
      if (reduced) return;
      try {
        playIvoireTone("welcome");
      } catch {
        /* autoplay may be blocked */
      }
    }, 350);
    const endTimer = window.setTimeout(() => finish(), duration);
    return () => {
      window.clearTimeout(audioTimer);
      window.clearTimeout(endTimer);
    };
  }, [enabled]);

  async function finish() {
    if (finished.current) return;
    finished.current = true;
    setVisible(false);
    await markWelcomeComplete();
  }

  if (!visible) return null;

  return (
    <div className="ivoire-welcome-overlay" role="dialog" aria-labelledby="ivoire-welcome-title">
      <button className="absolute right-4 top-4 min-h-11 min-w-11 text-sm font-semibold text-white" onClick={() => void finish()} type="button">
        Skip
      </button>
      <p className="ivoire-welcome-mark tracking-[0.22em]">IVOIRE SHOP</p>
      <span aria-hidden="true" className="ivoire-welcome-gold mt-6 h-px w-24 bg-gold" />
      <h2 className="ivoire-welcome-copy mt-8 text-center text-3xl font-semibold text-white sm:text-4xl" id="ivoire-welcome-title">
        Welcome to Ivoire Shop
      </h2>
      <p className="ivoire-welcome-copy mt-3 text-center text-sm text-white/80">Your account is ready.</p>
    </div>
  );
}
