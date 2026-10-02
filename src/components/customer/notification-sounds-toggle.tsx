"use client";

import { useFormStatus } from "react-dom";
import { setNotificationSounds } from "@/src/lib/customer/preferences";
import { TestSoundButton } from "@/src/components/customer/test-sound-button";

function SaveLabel({ children }: { children: string }) {
  const { pending } = useFormStatus();
  return <>{pending ? "Saving..." : children}</>;
}

function SoundChoice({ enabled, value, label }: { enabled: boolean; value: "on" | "off"; label: string }) {
  const active = value === "on" ? enabled : !enabled;
  return (
    <button
      className={`inline-flex min-h-11 min-w-16 items-center justify-center rounded-lg px-4 text-sm font-semibold ${active ? "bg-forest-green text-white" : "border border-forest-green/20 text-forest-green"}`}
      name="enabled"
      type="submit"
      value={value}
    >
      <SaveLabel>{label}</SaveLabel>
    </button>
  );
}

export function NotificationSoundsToggle({ enabled }: { enabled: boolean }) {
  return (
    <section className="mt-6 rounded-2xl border border-forest-green/15 bg-white p-5" id="notification-sounds">
      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-gold">Preferences</p>
      <h2 className="mt-2 text-xl font-semibold text-forest-green">Notification Sounds</h2>
      <p className="mt-2 text-sm font-semibold text-forest-green">{enabled ? "ON" : "OFF"}</p>
      <p className="mt-2 text-sm text-muted">
        Short Ivoire Shop cues play for new order updates while you are using the site. Your device volume, Silent Mode, and browser settings still apply.
      </p>
      <form action={setNotificationSounds} className="mt-4 flex flex-wrap gap-2">
        <SoundChoice enabled={enabled} label="ON" value="on" />
        <SoundChoice enabled={enabled} label="OFF" value="off" />
      </form>
      {enabled ? <TestSoundButton /> : null}
    </section>
  );
}
