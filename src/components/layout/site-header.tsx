import { getNavRole } from "@/src/lib/auth/session";
import { Header } from "@/src/components/layout/header";
import { getCustomerInbox } from "@/src/lib/notifications/inbox";
import type { InboxItem } from "@/src/lib/notifications/inbox-item";

export async function SiteHeader() {
  const initialRole = await getNavRole();
  let initialUnread = 0;
  let initialInbox: InboxItem[] = [];
  if (initialRole === "customer") {
    try {
      const inbox = await getCustomerInbox(12);
      if (inbox.kind === "found") {
        initialInbox = inbox.items;
        initialUnread = inbox.items.filter((item) => !item.read_at && !item.dismissed_at).length;
      }
    } catch {
      initialUnread = 0;
      initialInbox = [];
    }
  }
  return <Header initialInbox={initialInbox} initialRole={initialRole} initialUnread={initialUnread} />;
}
