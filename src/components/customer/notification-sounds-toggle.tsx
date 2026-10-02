"use client";

import { useFormStatus } from "react-dom";
import { setNotificationSounds } from "@/src/lib/customer/preferences";

function SaveLabel() {
  const { pending } = useFormStatus();
  return <>{pending ? "Saving..." : "Save"}</>;
}

export function NotificationSoundsToggle({ enabled }: { enabled: boolean }) {
  return (
    <form action={setNotificationSounds} className="mt-6 rounded-2xl border border-forest-green/15 bg-white p-5">
      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-gold">Preferences</p>
      <h2 className="mt-2 text-xl font-semibold text-forest-green">Notification Sounds</h2>
      <p className="mt-2 text-sm text-muted">
        Short tones play only for new order updates while you are using Ivoire Shop, after you interact with the page. Browsers may block sound.
      </p>
      <label className="mt-4 flex min-h-11 items-center gap-3 text-sm text-forest-green">
        <input defaultChecked={enabled} name="enabled" type="checkbox" />
        Notification Sounds {enabled ? "ON" : "OFF"}
      </label>
      <button className="mt-3 inline-flex min-h-11 items-center rounded-lg border border-forest-green/20 px-4 text-sm font-semibold text-forest-green" type="submit">
        <SaveLabel />
      </button>
    </form>
  );
}
