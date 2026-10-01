import Link from "next/link";
import { notificationIcon } from "@/src/lib/notifications/events";
import { acknowledgeInboxItem } from "@/src/lib/notifications/actions";
import type { InboxItem } from "@/src/lib/notifications/inbox-item";

export function NotificationCard({ item }: { item: InboxItem }) {
  const unread = !item.read_at && !item.dismissed_at;
  const href = item.kind === "order" && item.order_id ? `/account/orders/${item.order_id}` : item.action_href;
  return (
    <article className={`min-w-0 rounded-2xl border p-5 ${unread ? "border-gold/50 bg-white" : "border-forest-green/10 bg-[#f7f3ee]"}`}>
      <div className="flex items-start gap-3">
        <span aria-hidden="true" className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-forest-green text-sm font-semibold text-white">
          {notificationIcon(item.event_type)}
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-xs text-muted">{new Date(item.created_at).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}</p>
          <div className="mt-1 flex flex-wrap items-center gap-2">
            <h2 className="text-lg font-semibold text-forest-green">{item.title}</h2>
            {unread ? <span className="rounded-full bg-gold px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-forest-green">Unread</span> : <span className="text-[10px] font-semibold uppercase tracking-wide text-muted">Read</span>}
          </div>
          <p className="mt-2 whitespace-pre-line text-sm leading-6 text-muted">{item.message}</p>
          {item.confirmation_code ? (
            <p className="mt-2 font-mono text-sm tracking-[0.14em] text-forest-green">{item.confirmation_code}</p>
          ) : null}
          <div className="mt-4 flex flex-wrap items-center gap-3">
            {href ? (
              <Link className="inline-flex min-h-11 items-center rounded-lg border border-forest-green/20 px-4 text-sm font-semibold text-forest-green" href={href}>
                {item.kind === "order" ? "View Order" : item.action_label || "Read more"}
              </Link>
            ) : null}
            {unread ? (
              <form action={acknowledgeInboxItem}>
                <input name="id" type="hidden" value={item.id} />
                <input name="kind" type="hidden" value={item.kind} />
                <button className="inline-flex min-h-11 items-center px-2 text-sm font-semibold text-forest-green underline underline-offset-4" type="submit">
                  Mark as read
                </button>
              </form>
            ) : null}
          </div>
        </div>
      </div>
    </article>
  );
}
