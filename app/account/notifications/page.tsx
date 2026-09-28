import { pageMetadata } from "@/src/lib/page-metadata";
import { redirect } from "next/navigation";
import { Footer } from "@/src/components/layout/footer";
import { SiteHeader } from "@/src/components/layout/site-header";
import { CustomerAccountNav } from "@/src/components/customer/customer-account-nav";
import { NotificationCard } from "@/src/components/customer/notification-card";
import { SmartBackButton } from "@/src/components/navigation/smart-back-button";
import { getCustomerNotifications } from "@/src/lib/notifications/queries";
import { markAllNotificationsRead } from "@/src/lib/notifications/actions";

export const metadata = pageMetadata("Notifications", "Your Ivoire Shop order notifications.", "/account/notifications", false);

export default async function CustomerNotificationsPage() {
  const result = await getCustomerNotifications();
  if (result.kind === "unauthenticated") redirect("/login?next=/account/notifications");
  const unread = result.notifications.filter((item) => !item.read_at).length;

  return (
    <>
      <SiteHeader />
      <main className="mx-auto w-full max-w-3xl px-5 py-10 sm:px-6">
        <CustomerAccountNav />
        <SmartBackButton fallbackHref="/account" fallbackLabel="Back to account" />
        <div className="mt-6 flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-gold">Account</p>
            <h1 className="mt-2 text-4xl font-semibold text-forest-green">Notifications</h1>
            <p className="mt-2 text-sm text-muted">
              {unread > 0 ? `${unread} unread update${unread === 1 ? "" : "s"}.` : "You are caught up."}
            </p>
          </div>
          {unread > 0 ? (
            <form action={markAllNotificationsRead}>
              <button className="min-h-11 rounded-lg border border-forest-green/20 px-4 text-sm font-semibold text-forest-green" type="submit">
                Mark all as read
              </button>
            </form>
          ) : null}
        </div>
        <div className="mt-8 space-y-4">
          {result.notifications.length ? (
            result.notifications.map((notification) => (
              <NotificationCard key={notification.id} notification={notification} />
            ))
          ) : (
            <p className="rounded-2xl border border-dashed border-forest-green/20 bg-white p-8 text-sm text-muted">
              Order updates will appear here after you place an order while signed in.
            </p>
          )}
        </div>
      </main>
      <Footer />
    </>
  );
}
