import { acknowledgeInboxItem } from "@/src/lib/notifications/actions";
import type { InboxItem } from "@/src/lib/notifications/inbox-item";

export function CustomerAlertBanner({ item }: { item: InboxItem }) {
  return (
    <section className="overflow-hidden rounded-[28px] border border-gold/40 bg-white p-5 sm:p-6">
      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-gold">
        {item.kind === "announcement" ? "Fresh from Ivoire Shop" : "Update"}
      </p>
      <h2 className="mt-2 text-2xl font-semibold text-forest-green">{item.title}</h2>
      <p className="mt-3 whitespace-pre-line text-sm leading-6 text-muted">{item.message}</p>
      <div className="mt-5 flex min-w-0 flex-wrap gap-3">
        {item.kind === "order" && item.order_id ? (
          <a className="inline-flex min-h-11 items-center rounded-lg bg-forest-green px-4 text-sm font-semibold text-white" href={`/account/orders/${item.order_id}`}>
            {item.event_type === "shipped" || item.event_type === "tracking_added" || item.event_type === "tracking_updated" ? "Track Package" : "View Order"}
          </a>
        ) : null}
        {item.action_href && item.action_label ? (
          <a className="inline-flex min-h-11 items-center rounded-lg bg-forest-green px-4 text-sm font-semibold text-white" href={item.action_href}>
            {item.action_label}
          </a>
        ) : null}
        <form action={acknowledgeInboxItem}>
          <input name="id" type="hidden" value={item.id} />
          <input name="kind" type="hidden" value={item.kind} />
          <input name="dismiss" type="hidden" value="true" />
          <button className="inline-flex min-h-11 items-center rounded-lg border border-forest-green/20 px-4 text-sm font-semibold text-forest-green" type="submit">
            Dismiss
          </button>
        </form>
      </div>
    </section>
  );
}
