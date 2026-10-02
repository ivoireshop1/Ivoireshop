"use client";

import { useEffect, useRef } from "react";
import { createClient } from "@/src/lib/supabase/browser";
import { playNotificationEvent } from "@/src/lib/audio/ivoire-tones";

export function NotificationSoundListener({ enabled }: { enabled: boolean }) {
  const unlocked = useRef(false);

  useEffect(() => {
    function unlock() {
      unlocked.current = true;
    }
    window.addEventListener("pointerdown", unlock, { once: true });
    window.addEventListener("keydown", unlock, { once: true });
    return () => {
      window.removeEventListener("pointerdown", unlock);
      window.removeEventListener("keydown", unlock);
    };
  }, []);

  useEffect(() => {
    if (!enabled) return;
    const client = createClient();
    let channel: ReturnType<typeof client.channel> | null = null;
    let cancelled = false;
    void client.auth.getUser().then(({ data }) => {
      if (cancelled || !data.user) return;
      channel = client
        .channel(`order-status-sound-${data.user.id}`)
        .on(
          "postgres_changes",
          { event: "INSERT", schema: "public", table: "customer_notifications", filter: `user_id=eq.${data.user.id}` },
          (payload) => {
            if (!enabled || !unlocked.current) return;
            const row = payload.new as { id?: string; event_type?: string };
            if (!row.id || !row.event_type) return;
            playNotificationEvent(row.event_type, row.id);
          },
        )
        .subscribe();
    });
    return () => {
      cancelled = true;
      if (channel) void client.removeChannel(channel);
    };
  }, [enabled]);

  return null;
}
