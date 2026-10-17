"use client";

import { useActionState, useEffect, useState } from "react";
import { useFormStatus } from "react-dom";
import {
  setIvoirePlaybackAudience,
  setIvoirePlaybackVolumePercent,
  type IvoireTone,
} from "@/src/lib/audio/ivoire-tones";
import {
  DEFAULT_NOTIFICATION_VOLUME_PERCENT,
  SOUND_SETTINGS_EVENT,
  clampNotificationVolume,
  writeStoredVolumePercent,
} from "@/src/lib/audio/volume";
import { TestSoundButton } from "@/src/components/customer/test-sound-button";
import {
  setAdminNotificationSoundPreferences,
  setNotificationSoundPreferences,
} from "@/src/lib/customer/preferences";

function SaveLabel({ children }: { children: string }) {
  const { pending } = useFormStatus();
  return <>{pending ? "Saving..." : children}</>;
}

export function NotificationSoundSettings({
  audience,
  enabled,
  volume = DEFAULT_NOTIFICATION_VOLUME_PERCENT,
}: {
  audience: "admin" | "customer";
  enabled: boolean;
  volume?: number;
}) {
  const action = audience === "admin" ? setAdminNotificationSoundPreferences : setNotificationSoundPreferences;
  const [percent, setPercent] = useState(clampNotificationVolume(volume));
  const [state, formAction] = useActionState(action, null);
  const accent = audience === "admin" ? "text-[#173f35]" : "text-forest-green";
  const border = audience === "admin" ? "border-[#173f35]/15" : "border-forest-green/15";

  useEffect(() => {
    setIvoirePlaybackAudience(audience);
    setIvoirePlaybackVolumePercent(percent, audience);
    writeStoredVolumePercent(audience, percent);
    window.dispatchEvent(new CustomEvent(SOUND_SETTINGS_EVENT, { detail: { audience, volume: percent, enabled } }));
  }, [audience, enabled, percent]);

  const tests: { cue: IvoireTone; label: string }[] =
    audience === "admin"
      ? [
          { cue: "new_order", label: "Test New Order Sound" },
          { cue: "accepted", label: "Test Customer Update Sound" },
        ]
      : [{ cue: "ready", label: "Test Customer Update Sound" }];

  return (
    <section className={`rounded-2xl border ${border} bg-white p-5`} id={audience === "admin" ? "admin-notification-sounds" : "notification-sounds"}>
      <p className={`text-[11px] font-medium uppercase tracking-[0.2em] ${audience === "admin" ? "text-[#b8964c]" : "text-gold"}`}>
        {audience === "admin" ? "Notifications" : "Preferences"}
      </p>
      <h2 className={`mt-2 text-xl font-semibold ${accent}`}>
        {audience === "admin" ? "Admin Notification Sounds" : "Notification Sounds"}
      </h2>
      <p className={`mt-2 text-sm font-semibold ${accent}`}>{enabled ? "ON" : "OFF"}</p>
      <p className={`mt-2 text-sm ${audience === "admin" ? "text-[#6b6b6b]" : "text-muted"}`}>
        {audience === "admin"
          ? "Short cues play for new orders, messages, reviews, and shipping attention while this admin session is open."
          : "Short Ivoire Shop cues play for new order updates while you are using the site. Your device volume, Silent Mode, and browser settings still apply."}
      </p>
      <form action={formAction} className="mt-4 space-y-4">
        <input name="volume" type="hidden" value={percent} />
        <div className="flex flex-wrap gap-2">
          <button
            className={`inline-flex min-h-11 min-w-16 items-center justify-center rounded-lg px-4 text-sm font-semibold ${enabled ? (audience === "admin" ? "bg-[#173f35] text-white" : "bg-forest-green text-white") : `border ${border} ${accent}`}`}
            name="enabled"
            type="submit"
            value="on"
          >
            <SaveLabel>ON</SaveLabel>
          </button>
          <button
            className={`inline-flex min-h-11 min-w-16 items-center justify-center rounded-lg px-4 text-sm font-semibold ${!enabled ? (audience === "admin" ? "bg-[#173f35] text-white" : "bg-forest-green text-white") : `border ${border} ${accent}`}`}
            name="enabled"
            type="submit"
            value="off"
          >
            <SaveLabel>OFF</SaveLabel>
          </button>
        </div>
        <label className={`block text-sm ${accent}`} htmlFor={`${audience}-notification-volume`}>
          Notification volume {percent}%
          <input
            className="mt-2 w-full accent-[#173f35]"
            id={`${audience}-notification-volume`}
            max={100}
            min={0}
            onChange={(event) => setPercent(Number(event.target.value))}
            step={1}
            type="range"
            value={percent}
          />
        </label>
        <button
          className={`inline-flex min-h-11 items-center rounded-lg px-4 text-sm font-semibold ${audience === "admin" ? "border border-[#173f35]/20 text-[#173f35]" : "border border-forest-green/20 text-forest-green"}`}
          name="enabled"
          type="submit"
          value={enabled ? "on" : "off"}
        >
          <SaveLabel>Save volume</SaveLabel>
        </button>
        {state?.saved ? <p className={`text-sm font-semibold ${accent}`}>Sound settings saved.</p> : null}
        {state?.error ? <p className="text-sm text-red-700">{state.error}</p> : null}
      </form>
      {enabled ? (
        <div className="mt-2 flex flex-wrap gap-3">
          {tests.map((item) => (
            <TestSoundButton cue={item.cue} key={item.cue} label={item.label} />
          ))}
        </div>
      ) : null}
    </section>
  );
}
