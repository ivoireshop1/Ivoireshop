"use client";

import Link from "next/link";
import { useEffect, useId, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/src/lib/supabase/browser";

export function NotificationBell({ initialUnread }: { initialUnread: number }) {
  const [liveUnread, setLiveUnread] = useState<number | null>(null);
  const [open, setOpen] = useState(false);
  const router = useRouter();
  const menuId = useId();
  const root = useRef<HTMLDivElement>(null);
  const unread = liveUnread ?? initialUnread;

  useEffect(() => {
    const client = createClient();
    let channel: ReturnType<typeof client.channel> | null = null;
    let cancelled = false;
    void client.auth.getUser().then(({ data }) => {
      if (cancelled || !data.user) return;
      const refreshUnread = () => {
        setLiveUnread(null);
        router.refresh();
      };
      channel = client
        .channel(`customer-inbox-${data.user.id}`)
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "customer_notifications", filter: `user_id=eq.${data.user.id}` },
          refreshUnread,
        )
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "customer_announcement_reads", filter: `user_id=eq.${data.user.id}` },
          refreshUnread,
        )
        .subscribe();
    });
    return () => {
      cancelled = true;
      if (channel) void client.removeChannel(channel);
    };
  }, [router]);

  useEffect(() => {
    function onPointer(event: MouseEvent) {
      if (!root.current?.contains(event.target as Node)) setOpen(false);
    }
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, []);

  const label = unread > 0 ? `Notifications, ${unread} unread` : "Notifications";
  const badge = unread > 99 ? "99+" : String(unread);

  return (
    <div className="relative shrink-0" ref={root}>
      <button
        aria-controls={menuId}
        aria-expanded={open}
        aria-label={label}
        className="relative inline-flex min-h-11 min-w-11 items-center justify-center text-forest-green"
        onClick={() => setOpen((value) => !value)}
        type="button"
      >
        <BellIcon />
        {unread > 0 ? (
          <span className="absolute right-0.5 top-1 min-w-4 rounded-full bg-gold px-1 text-[10px] font-semibold leading-4 text-forest-green">
            {badge}
            <span className="sr-only"> unread</span>
          </span>
        ) : null}
      </button>
      {open ? (
        <div className="absolute right-0 z-30 mt-2 w-[min(calc(100vw-2rem),20rem)] rounded-2xl border border-forest-green/15 bg-white p-3 shadow-lg" id={menuId} role="menu">
          <p className="px-2 text-xs font-semibold uppercase tracking-[0.18em] text-gold">Notifications</p>
          <Link className="mt-2 flex min-h-11 items-center rounded-xl px-2 text-sm font-semibold text-forest-green" href="/account/notifications" onClick={() => setOpen(false)} role="menuitem">
            View all notifications{unread > 0 ? ` (${badge} unread)` : ""}
          </Link>
        </div>
      ) : null}
    </div>
  );
}

function BellIcon() {
  return (
    <svg aria-hidden="true" className="h-5 w-5" fill="none" viewBox="0 0 24 24">
      <path d="M12 4a5 5 0 0 1 5 5v2.2c0 .7.2 1.3.6 1.9L19 16H5l1.4-2.9c.4-.6.6-1.2.6-1.9V9a5 5 0 0 1 5-5Z" stroke="currentColor" strokeLinejoin="round" strokeWidth="1.7" />
      <path d="M9.5 16a2.5 2.5 0 0 0 5 0" stroke="currentColor" strokeLinecap="round" strokeWidth="1.7" />
    </svg>
  );
}
