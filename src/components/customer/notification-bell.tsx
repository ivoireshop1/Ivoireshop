"use client";

import Link from "next/link";
import { useEffect, useId, useRef, useState } from "react";
import type { InboxItem } from "@/src/lib/notifications/inbox-item";
import { useLiveNotifications } from "@/src/components/realtime/live-notifications-provider";

export function NotificationBell({
  initialUnread,
  initialInbox = [],
  historyHref = "/account/notifications",
}: {
  initialUnread: number;
  initialInbox?: InboxItem[];
  historyHref?: string;
}) {
  const live = useLiveNotifications();
  const [open, setOpen] = useState(false);
  const menuId = useId();
  const headingId = useId();
  const root = useRef<HTMLDivElement>(null);
  const items = live.items.length ? live.items : initialInbox;
  const unread = live.role === "guest" ? initialUnread : live.unread;

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

  useEffect(() => {
    if (!open) return;
    const original = document.body.style.overflow;
    const mq = window.matchMedia("(max-width: 767px)");
    if (mq.matches) document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = original;
    };
  }, [open]);

  const badge = unread > 99 ? "99+" : String(unread);

  return (
    <div className="relative shrink-0" ref={root}>
      <button
        aria-controls={menuId}
        aria-expanded={open}
        aria-haspopup="dialog"
        aria-label="Notifications"
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
        <>
          <button
            aria-hidden="true"
            className="fixed inset-0 z-40 bg-black/25 md:hidden"
            onClick={() => setOpen(false)}
            tabIndex={-1}
            type="button"
          />
          <div
            aria-labelledby={headingId}
            className="fixed left-3 right-3 top-[4.75rem] z-50 max-h-[min(70dvh,32rem)] overflow-y-auto overflow-x-hidden rounded-2xl border border-forest-green/15 bg-white p-3 shadow-lg md:absolute md:left-auto md:right-0 md:top-auto md:mt-2 md:w-80 md:max-w-[min(20rem,calc(100vw-1.5rem))]"
            id={menuId}
            role="dialog"
          >
            <div className="flex items-start justify-between gap-3 px-1">
              <h2 className="text-base font-semibold text-forest-green" id={headingId}>
                Notifications
              </h2>
              <div className="flex items-center gap-1">
                {unread > 0 ? (
                  <button className="min-h-11 px-2 text-xs font-semibold text-forest-green underline" onClick={() => live.markAllRead()} type="button">
                    Mark all as read
                  </button>
                ) : null}
                <button
                  aria-label="Close notifications"
                  className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-lg text-sm font-semibold text-forest-green"
                  onClick={() => setOpen(false)}
                  type="button"
                >
                  Close
                </button>
              </div>
            </div>
            <ul className="mt-2 space-y-2">
              {items.length ? (
                items.slice(0, 8).map((item) => (
                  <li key={`${item.kind}-${item.id}`}>
                    <InboxPreview
                      historyHref={historyHref}
                      item={item}
                      onDone={() => {
                        live.markItemRead(item);
                        setOpen(false);
                      }}
                    />
                  </li>
                ))
              ) : (
                <li className="px-2 py-3 text-sm text-muted">You are caught up. History stays in notifications.</li>
              )}
            </ul>
            <Link
              className="mt-2 flex min-h-11 items-center rounded-xl px-2 text-sm font-semibold text-forest-green"
              href={historyHref}
              onClick={() => setOpen(false)}
            >
              View all notifications{unread > 0 ? ` (${badge} unread)` : ""}
            </Link>
          </div>
        </>
      ) : null}
    </div>
  );
}

function InboxPreview({ item, onDone, historyHref }: { item: InboxItem; onDone: () => void; historyHref: string }) {
  const unread = !item.read_at && !item.dismissed_at;
  const href = item.action_href || (item.kind === "order" && item.order_id ? (historyHref.startsWith("/admin") ? `/admin/orders/${item.order_id}` : `/account/orders/${item.order_id}`) : historyHref);
  return (
    <article className={`rounded-xl border px-3 py-3 ${unread ? "border-gold/40 bg-[#fffdf8]" : "border-forest-green/10 bg-[#f7f3ee]"}`}>
      <div className="flex flex-wrap items-center gap-2">
        <p className="min-w-0 flex-1 break-words font-semibold text-forest-green">{item.title}</p>
        {unread ? <span className="rounded-full bg-gold px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-forest-green">Unread</span> : null}
      </div>
      <p className="mt-1 whitespace-pre-line break-words text-sm leading-5 text-muted">{item.message}</p>
      <p className="mt-1 text-xs text-muted">
        {new Date(item.created_at).toLocaleString(undefined, { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" })}
      </p>
      <div className="mt-2 flex flex-wrap gap-2">
        <Link className="inline-flex min-h-11 items-center rounded-lg border border-forest-green/20 px-3 text-sm font-semibold text-forest-green" href={href} onClick={onDone}>
          {item.action_label || (item.kind === "order" ? "View" : "View")}
        </Link>
        {unread ? (
          <button className="inline-flex min-h-11 items-center px-2 text-sm font-semibold text-forest-green underline underline-offset-4" onClick={onDone} type="button">
            Mark as read
          </button>
        ) : null}
      </div>
    </article>
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
