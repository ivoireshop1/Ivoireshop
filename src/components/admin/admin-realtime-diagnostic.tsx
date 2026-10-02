"use client";

import { useLiveNotifications } from "@/src/components/realtime/live-notifications-provider";

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-3">
      <dt className="shrink-0 text-[#6b6b6b]">{label}</dt>
      <dd className="max-w-[65%] break-all text-right font-semibold text-[#173f35]">{value}</dd>
    </div>
  );
}

export function AdminRealtimeDiagnostic() {
  const { connection, soundsEnabled, lastPlay, audioUnlocked, probe } = useLiveNotifications();
  const playLabel =
    lastPlay?.result === "resolved" ? "RESOLVED" :
    lastPlay?.result === "rejected" ? `REJECTED${lastPlay.reason ? ` (${lastPlay.reason})` : ""}` :
    lastPlay?.result === "not_called" ? `NOT CALLED${lastPlay.reason ? ` (${lastPlay.reason})` : ""}` :
    "NOT CALLED";
  const connected = connection === "live" && probe.channelStatus === "SUBSCRIBED";

  return (
    <section className="rounded-2xl border border-[#173f35]/15 bg-[#f9f7f3] p-4 text-sm">
      <p className="text-[11px] font-medium uppercase tracking-[0.2em] text-[#b8964c]">Temporary diagnostic</p>
      <h2 className="mt-1 text-base font-semibold text-[#173f35]">Realtime probe</h2>
      <dl className="mt-3 grid gap-1.5">
        <Row label="Realtime URL" value={probe.supabaseUrl} />
        <Row label="Project host" value={probe.supabaseHost} />
        <Row label="Auth user" value={probe.authUser} />
        <Row label="JWT attached" value={probe.jwtAttached} />
        <Row label="Channel" value={probe.channelName} />
        <Row label="Channel status" value={connected ? "SUBSCRIBED" : probe.channelStatus} />
        <Row label="Last database event" value={probe.lastDbEventAt ? new Date(probe.lastDbEventAt).toLocaleTimeString() : "NONE"} />
        <Row label="Last event table" value={probe.lastDbTable ?? "NONE"} />
        <Row label="Last event type" value={probe.lastDbEventType ?? "NONE"} />
        <Row label="Last event ID" value={probe.lastDbIdShort ?? "NONE"} />
        <Row label="Last UI update" value={probe.lastUiUpdateAt ? new Date(probe.lastUiUpdateAt).toLocaleTimeString() : "NONE"} />
        <Row label="Audio unlocked" value={audioUnlocked ? "YES" : "NO"} />
        <Row label="Last sound requested" value={lastPlay?.cue ?? "NONE"} />
        <Row label="Last play()" value={playLabel} />
        <Row label="Notification Sounds" value={soundsEnabled ? "On" : "Off"} />
      </dl>
    </section>
  );
}
