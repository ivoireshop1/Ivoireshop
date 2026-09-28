import Link from "next/link";
import { notificationIcon } from "@/src/lib/notifications/events";
import { markOneNotificationRead } from "@/src/lib/notifications/actions";
import type { CustomerNotification } from "@/src/lib/notifications/record";

export function NotificationCard({ notification }: { notification: CustomerNotification }) {
  const unread = !notification.read_at;
  return (
    <article className={`rounded-2xl border p-5 ${unread ? "border-gold/50 bg-white" : "border-forest-green/10 bg-[#f7f3ee]"}`}>
      <div className="flex items-start gap-3">
        <span aria-hidden="true" className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-forest-green text-sm font-semibold text-white">
          {notificationIcon(notification.event_type)}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-lg font-semibold text-forest-green">{notification.title}</h2>
            {unread ? <span className="rounded-full bg-gold px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-forest-green">Unread</span> : <span className="text-[10px] font-semibold uppercase tracking-wide text-muted">Read</span>}
          </div>
          <p className="mt-2 whitespace-pre-line text-sm leading-6 text-muted">{notification.message}</p>
          {notification.confirmation_code ? (
            <p className="mt-2 font-mono text-sm tracking-[0.14em] text-forest-green">{notification.confirmation_code}</p>
          ) : null}
          <p className="mt-2 text-xs text-muted">{new Date(notification.created_at).toLocaleString()}</p>
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <Link className="inline-flex min-h-11 items-center rounded-lg border border-forest-green/20 px-4 text-sm font-semibold text-forest-green" href={`/account/orders/${notification.order_id}`}>
              View Order
            </Link>
            {unread ? (
              <form action={markOneNotificationRead}>
                <input name="id" type="hidden" value={notification.id} />
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
