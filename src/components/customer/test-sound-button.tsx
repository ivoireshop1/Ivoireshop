"use client";

import { useState } from "react";
import { playIvoireCue } from "@/src/lib/audio/ivoire-tones";

export function TestSoundButton() {
  const [state, setState] = useState<"idle" | "playing" | "played" | "blocked">("idle");

  async function onPlay() {
    setState("playing");
    const result = await playIvoireCue("ready");
    setState(result.ok ? "played" : "blocked");
  }

  const label =
    state === "playing" ? "Playing…" :
    state === "played" ? "Sound played ✓" :
    state === "blocked" ? "Sound blocked" :
    "🔊 Test Sound";

  return (
    <div className="mt-4">
      <button
        className="inline-flex min-h-11 items-center rounded-lg bg-forest-green px-4 text-sm font-semibold text-white"
        disabled={state === "playing"}
        onClick={() => void onPlay()}
        type="button"
      >
        {label}
      </button>
      {state === "blocked" ? (
        <p className="mt-2 text-sm text-muted">
          Sound couldn&apos;t play on this device. Check your device volume and browser settings.
        </p>
      ) : null}
    </div>
  );
}
