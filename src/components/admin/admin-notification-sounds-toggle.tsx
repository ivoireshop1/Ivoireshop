"use client";

import { useFormStatus } from "react-dom";
import { setAdminNotificationSounds } from "@/src/lib/customer/preferences";
import { TestSoundButton } from "@/src/components/customer/test-sound-button";

function SaveLabel({ children }: { children: string }) {
  const { pending } = useFormStatus();
  return <>{pending ? "Saving..." : children}</>;
}

export function AdminNotificationSoundsToggle({ enabled }: { enabled: boolean }) {
  return (
    <section className="rounded-2xl border border-[#173f35]/15 bg-white p-5" id="admin-notification-sounds">
      <p className="text-[11px] font-medium uppercase tracking-[0.2em] text-[#b8964c]">Notifications</p>
      <h2 className="mt-2 text-xl font-semibold text-[#173f35]">Admin Notification Sounds</h2>
      <p className="mt-2 text-sm font-semibold text-[#173f35]">{enabled ? "ON" : "OFF"}</p>
      <p className="mt-2 text-sm text-[#6b6b6b]">
        Short cues play for new orders, messages, reviews, and shipping attention while this admin session is open.
      </p>
      <form action={setAdminNotificationSounds} className="mt-4 flex flex-wrap gap-2">
        <button
          className={`inline-flex min-h-11 min-w-16 items-center justify-center rounded-lg px-4 text-sm font-semibold ${enabled ? "bg-[#173f35] text-white" : "border border-[#173f35]/20 text-[#173f35]"}`}
          name="enabled"
          type="submit"
          value="on"
        >
          <SaveLabel>ON</SaveLabel>
        </button>
        <button
          className={`inline-flex min-h-11 min-w-16 items-center justify-center rounded-lg px-4 text-sm font-semibold ${!enabled ? "bg-[#173f35] text-white" : "border border-[#173f35]/20 text-[#173f35]"}`}
          name="enabled"
          type="submit"
          value="off"
        >
          <SaveLabel>OFF</SaveLabel>
        </button>
      </form>
      {enabled ? <TestSoundButton cue="accepted" label="🔊 Test Admin Sound" /> : null}
    </section>
  );
}
