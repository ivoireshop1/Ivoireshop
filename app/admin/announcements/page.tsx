import Link from "next/link";
import { requireAdmin } from "@/src/lib/auth/guards";
import { AdminLoadFailure } from "@/src/components/admin/admin-load-failure";
import { CustomerAnnouncementManager } from "@/src/components/admin/customer-announcement-manager";
import { announcementDashboardCounts, listAdminAnnouncements } from "@/src/lib/admin/customer-announcements";
import { recordAdminIncident } from "@/src/lib/ops/incident";

export default async function AdminAnnouncementsPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; success?: string }>;
}) {
  await requireAdmin();
  const notices = (await searchParams) ?? {};
  let listed: Awaited<ReturnType<typeof listAdminAnnouncements>>;
  try {
    listed = await listAdminAnnouncements();
  } catch (caught) {
    const digest = typeof caught === "object" && caught && "digest" in caught ? String((caught as { digest?: string }).digest) : "";
    if (digest.startsWith("NEXT_REDIRECT") || digest.startsWith("NEXT_HTTP")) throw caught;
    recordAdminIncident({
      route: "/admin/announcements",
      feature: "announcement_page",
      category: "unknown",
      safeCode: "ADM-ANNOUNCEMENTS-LOAD",
    });
    return (
      <AdminLoadFailure
        code="ADM-ANNOUNCEMENTS-LOAD"
        message="Unable to load announcements."
        title="Announcements"
      />
    );
  }
  if (!listed.ok) {
    return (
      <AdminLoadFailure
        code="ADM-ANNOUNCEMENTS-LOAD"
        message="Unable to load announcements."
        title="Announcements"
      />
    );
  }
  const announcements = listed.items;
  const counts = announcementDashboardCounts(announcements);
  return (
    <div className="min-w-0 space-y-6 overflow-x-hidden">
      <div>
        <p className="text-[11px] font-medium uppercase tracking-[0.24em] text-[#b8964c]">Customers</p>
        <h1 className="mt-2 text-3xl font-semibold text-[#173f35]">Announcements</h1>
        <p className="mt-2 max-w-2xl text-sm text-[#6b6b6b]">In-app notices for signed-in customers. Publishing does not email customers.</p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-2xl bg-white p-4"><p className="text-sm text-[#6b6b6b]">Published</p><p className="mt-2 text-2xl font-semibold text-[#173f35]">{counts.published}</p></div>
        <div className="rounded-2xl bg-white p-4"><p className="text-sm text-[#6b6b6b]">Scheduled</p><p className="mt-2 text-2xl font-semibold text-[#173f35]">{counts.scheduled}</p></div>
        <div className="rounded-2xl bg-white p-4"><p className="text-sm text-[#6b6b6b]">Drafts</p><p className="mt-2 text-2xl font-semibold text-[#173f35]">{counts.drafts}</p></div>
        <div className="rounded-2xl bg-white p-4"><p className="text-sm text-[#6b6b6b]">Recently published</p><p className="mt-2 text-2xl font-semibold text-[#173f35]">{counts.recentlyPublished}</p></div>
      </div>

      <CustomerAnnouncementManager announcements={announcements} notice={notices} />
      <p className="text-sm text-[#6b6b6b]"><Link className="underline" href="/admin/content">Storefront billboard promotions</Link> remain separate from customer announcements.</p>
    </div>
  );
}
