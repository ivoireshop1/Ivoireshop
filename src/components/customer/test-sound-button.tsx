"use client";

import { useState } from "react";
import { playIvoireSound, type IvoireTone } from "@/src/lib/audio/ivoire-tones";

export function TestSoundButton({
  cue = "ready",
  label = "🔊 Test Sound",
}: {
  cue?: IvoireTone;
  label?: string;
}) {
  const [state, setState] = useState<"idle" | "playing" | "played" | "blocked">("idle");

  async function onPlay() {
    setState("playing");
    const result = await playIvoireSound(cue);
    setState(result.ok ? "played" : "blocked");
  }

  const buttonLabel =
    state === "playing" ? "Playing…" :
    state === "played" ? "Sound played ✓" :
    state === "blocked" ? "Sound blocked" :
    label;

  return (
    <div className="mt-4">
      <button
        className="inline-flex min-h-11 items-center rounded-lg bg-forest-green px-4 text-sm font-semibold text-white"
        disabled={state === "playing"}
        onClick={() => void onPlay()}
        type="button"
      >
        {buttonLabel}
      </button>
      {state === "blocked" ? (
        <p className="mt-2 text-sm text-muted">
          Sound couldn&apos;t play on this device. Check your device volume and browser settings.
        </p>
      ) : null}
    </div>
  );
}
