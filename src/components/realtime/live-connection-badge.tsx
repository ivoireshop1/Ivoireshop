"use client";

import { useLiveNotifications } from "@/src/components/realtime/live-notifications-provider";

export function LiveConnectionBadge() {
  const { connection, role, probe } = useLiveNotifications();
  if (role !== "admin") return null;
  const live = connection === "live" && probe.channelStatus === "SUBSCRIBED";
  const label = live ? "Live" : connection === "reconnecting" ? "Reconnecting…" : "Offline";
  return (
    <p className="inline-flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-[0.16em] text-[#173f35]/70" title="Realtime monitoring">
      <span className={`h-1.5 w-1.5 rounded-full ${live ? "bg-[#2f7d4a]" : connection === "reconnecting" ? "bg-[#b8964c]" : "bg-[#8a8a8a]"}`} />
      {label}
    </p>
  );
}
