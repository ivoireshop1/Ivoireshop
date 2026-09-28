import { getNavRole } from "@/src/lib/auth/session";
import { Header } from "@/src/components/layout/header";
import { getUnreadNotificationCount } from "@/src/lib/notifications/queries";

export async function SiteHeader() {
  const initialRole = await getNavRole();
  const initialUnread = initialRole === "customer" ? await getUnreadNotificationCount() : 0;
  return <Header initialRole={initialRole} initialUnread={initialUnread} />;
}
