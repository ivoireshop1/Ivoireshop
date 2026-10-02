"use client";

import { useLiveNotifications } from "@/src/components/realtime/live-notifications-provider";

export function AdminRealtimeDiagnostic() {
  const { connection, soundsEnabled, lastEvent, lastPlay, audioUnlocked } = useLiveNotifications();
  const playLabel =
    lastPlay?.result === "resolved" ? "RESOLVED" :
    lastPlay?.result === "rejected" ? `REJECTED${lastPlay.reason ? ` (${lastPlay.reason})` : ""}` :
    lastPlay?.result === "not_called" ? `NOT CALLED${lastPlay.reason ? ` (${lastPlay.reason})` : ""}` :
    "—";

  return (
    <section className="rounded-2xl border border-[#173f35]/15 bg-[#f9f7f3] p-5">
      <p className="text-[11px] font-medium uppercase tracking-[0.2em] text-[#b8964c]">Support</p>
      <h2 className="mt-2 text-lg font-semibold text-[#173f35]">Realtime diagnostic</h2>
      <dl className="mt-3 grid gap-2 text-sm text-[#173f35]">
        <div className="flex justify-between gap-3"><dt>Realtime</dt><dd className="font-semibold">{connection === "live" ? "Connected" : connection === "reconnecting" ? "Reconnecting…" : "Offline"}</dd></div>
        <div className="flex justify-between gap-3"><dt>Audio</dt><dd className="font-semibold">{audioUnlocked ? "Unlocked" : "Locked"}</dd></div>
        <div className="flex justify-between gap-3"><dt>Notification Sounds</dt><dd className="font-semibold">{soundsEnabled ? "On" : "Off"}</dd></div>
        <div className="flex justify-between gap-3"><dt>Last event</dt><dd className="max-w-[60%] truncate text-right font-semibold">{lastEvent ? `${lastEvent.eventType} · ${new Date(lastEvent.at).toLocaleTimeString()}` : "—"}</dd></div>
        <div className="flex justify-between gap-3"><dt>Last play()</dt><dd className="font-semibold">{playLabel}</dd></div>
      </dl>
    </section>
  );
}
