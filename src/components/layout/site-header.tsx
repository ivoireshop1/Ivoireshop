import { getNavRole } from "@/src/lib/auth/session";
import { Header } from "@/src/components/layout/header";
import { getCustomerInbox } from "@/src/lib/notifications/inbox";
import type { InboxItem } from "@/src/lib/notifications/inbox-item";
import { getCategories } from "@/src/lib/catalog/catalog";
import { CANONICAL_CATEGORIES } from "@/src/lib/catalog/canonical-categories";
import { createClient } from "@/src/lib/supabase/server";

export async function SiteHeader() {
  const initialRole = await getNavRole();
  let initialUnread = 0;
  let initialInbox: InboxItem[] = [];
  let notificationSounds = true;
  const live = await getCategories();
  const navCategories = CANONICAL_CATEGORIES.map((canonical) => {
    const match = live.find((category) => category.slug === canonical.slug);
    return { slug: canonical.slug, name: match?.name ?? canonical.name };
  });
  if (initialRole === "customer") {
    try {
      const supabase = await createClient();
      const [{ data: { user } }, inbox] = await Promise.all([
        supabase.auth.getUser(),
        getCustomerInbox(12),
      ]);
      if (inbox.kind === "found") {
        initialInbox = inbox.items;
        initialUnread = inbox.items.filter((item) => !item.read_at && !item.dismissed_at).length;
      }
      if (user) {
        const { data: profile } = await supabase.from("profiles").select("notification_sounds").eq("id", user.id).maybeSingle();
        notificationSounds = profile?.notification_sounds !== false;
      }
    } catch {
      initialUnread = 0;
      initialInbox = [];
    }
  }
  return <Header initialInbox={initialInbox} initialRole={initialRole} initialUnread={initialUnread} navCategories={navCategories} notificationSounds={notificationSounds} />;
}
