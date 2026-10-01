import Link from "next/link";
import { requireAdmin } from "@/src/lib/auth/guards";
import { AdminLoadFailure } from "@/src/components/admin/admin-load-failure";
import { AdminSaveButton } from "@/src/components/admin/admin-save-button";
import {
  announcementDashboardCounts,
  displayAnnouncementStatus,
  listAdminAnnouncements,
  toDatetimeLocalValue,
} from "@/src/lib/admin/customer-announcements";
import {
  createCustomerAnnouncement,
  setCustomerAnnouncementStatus,
  updateCustomerAnnouncement,
} from "@/src/lib/admin/customer-announcement-actions";

export default async function AdminAnnouncementsPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; success?: string }>;
}) {
  await requireAdmin();
  const notices = await searchParams;
  const listed = await listAdminAnnouncements();
  if (!listed.ok) {
    return <AdminLoadFailure message="Unable to load announcements." title="Announcements" />;
  }
  const announcements = listed.items;
  const counts = await announcementDashboardCounts(announcements);
  return (
    <div className="min-w-0 space-y-6 overflow-x-hidden">
      <div>
        <p className="text-[11px] font-medium uppercase tracking-[0.24em] text-[#b8964c]">Customers</p>
        <h1 className="mt-2 text-3xl font-semibold text-[#173f35]">Announcements</h1>
        <p className="mt-2 max-w-2xl text-sm text-[#6b6b6b]">In-app notices for signed-in customers. Publishing does not email customers.</p>
      </div>
      {notices.error === "required" ? <p className="rounded-xl bg-red-50 p-3 text-sm text-red-800">Title and message are required.</p> : null}
      {notices.error === "href" ? <p className="rounded-xl bg-red-50 p-3 text-sm text-red-800">Action destination must be a site path starting with / or an https URL.</p> : null}
      {notices.error === "schedule" ? <p className="rounded-xl bg-red-50 p-3 text-sm text-red-800">Schedule needs a future start date and time.</p> : null}
      {notices.error === "save" ? <p className="rounded-xl bg-red-50 p-3 text-sm text-red-800">The announcement could not be saved.</p> : null}
      {notices.success === "saved" ? <p className="rounded-xl bg-[#173f35]/5 p-3 text-sm text-[#173f35]">Announcement saved.</p> : null}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-2xl bg-white p-4"><p className="text-sm text-[#6b6b6b]">Published</p><p className="mt-2 text-2xl font-semibold text-[#173f35]">{counts.published}</p></div>
        <div className="rounded-2xl bg-white p-4"><p className="text-sm text-[#6b6b6b]">Scheduled</p><p className="mt-2 text-2xl font-semibold text-[#173f35]">{counts.scheduled}</p></div>
        <div className="rounded-2xl bg-white p-4"><p className="text-sm text-[#6b6b6b]">Drafts</p><p className="mt-2 text-2xl font-semibold text-[#173f35]">{counts.drafts}</p></div>
        <div className="rounded-2xl bg-white p-4"><p className="text-sm text-[#6b6b6b]">Recently published</p><p className="mt-2 text-2xl font-semibold text-[#173f35]">{counts.recentlyPublished}</p></div>
      </div>

      <form action={createCustomerAnnouncement} className="space-y-4 rounded-2xl bg-white p-5">
        <h2 className="font-semibold text-[#173f35]">Create Announcement</h2>
        <label className="block text-sm">Title<input className="mt-2 min-h-11 w-full min-w-0 rounded-xl border border-[#173f35]/15 px-3" maxLength={160} name="title" required /></label>
        <label className="block text-sm">Message<textarea className="mt-2 min-h-28 w-full min-w-0 rounded-xl border border-[#173f35]/15 px-3 py-2" maxLength={4000} name="message" required /></label>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block text-sm">Action label (optional)<input className="mt-2 min-h-11 w-full min-w-0 rounded-xl border border-[#173f35]/15 px-3" name="action_label" placeholder="Read more" /></label>
          <label className="block text-sm">Action destination (optional)<input className="mt-2 min-h-11 w-full min-w-0 rounded-xl border border-[#173f35]/15 px-3" name="action_href" placeholder="/shop or https://" /></label>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block text-sm">Start / publish<input className="mt-2 min-h-11 w-full min-w-0 rounded-xl border border-[#173f35]/15 px-3" name="starts_at" type="datetime-local" /></label>
          <label className="block text-sm">Expiration<input className="mt-2 min-h-11 w-full min-w-0 rounded-xl border border-[#173f35]/15 px-3" name="ends_at" type="datetime-local" /></label>
        </div>
        <p className="text-sm text-[#6b6b6b]">Audience: All Customers</p>
        <div className="flex min-w-0 flex-wrap gap-3">
          <button className="min-h-11 rounded-xl border border-[#173f35]/20 px-4 text-sm font-medium text-[#173f35]" name="intent" type="submit" value="draft">Save draft</button>
          <button className="min-h-11 rounded-xl border border-[#173f35]/20 px-4 text-sm font-medium text-[#173f35]" name="intent" type="submit" value="schedule">Schedule</button>
          <button className="min-h-11 rounded-xl bg-[#173f35] px-4 text-sm font-medium text-white" name="intent" type="submit" value="publish">Publish</button>
        </div>
      </form>

      <div className="space-y-4">
        {!announcements.length ? (
          <p className="rounded-2xl border border-dashed border-[#173f35]/20 bg-white p-8 text-sm text-[#6b6b6b]">No announcements yet.</p>
        ) : null}
        {announcements.map((announcement) => {
          const status = displayAnnouncementStatus(announcement);
          return (
            <article className="min-w-0 rounded-2xl bg-white p-5" key={announcement.id}>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h2 className="text-lg font-semibold text-[#173f35]">{announcement.title}</h2>
                <span className="rounded-full bg-[#173f35]/10 px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-[#173f35]">{status}</span>
              </div>
              <p className="mt-2 whitespace-pre-line text-sm text-[#6b6b6b]">{announcement.message}</p>
              <p className="mt-2 text-xs text-[#6b6b6b]">Published: {announcement.published_at ? new Date(announcement.published_at).toLocaleString() : "—"} · Expires: {announcement.ends_at ? new Date(announcement.ends_at).toLocaleString() : "—"}</p>
              <form action={updateCustomerAnnouncement} className="mt-4 grid gap-3 sm:grid-cols-2">
                <input name="id" type="hidden" value={announcement.id} />
                <label className="block text-sm sm:col-span-2">Title<input className="mt-2 min-h-11 w-full min-w-0 rounded-xl border border-[#173f35]/15 px-3" defaultValue={announcement.title} name="title" /></label>
                <label className="block text-sm sm:col-span-2">Message<textarea className="mt-2 min-h-24 w-full min-w-0 rounded-xl border border-[#173f35]/15 px-3 py-2" defaultValue={announcement.message} name="message" /></label>
                <label className="block text-sm">Action label<input className="mt-2 min-h-11 w-full min-w-0 rounded-xl border border-[#173f35]/15 px-3" defaultValue={announcement.action_label ?? ""} name="action_label" /></label>
                <label className="block text-sm">Action destination<input className="mt-2 min-h-11 w-full min-w-0 rounded-xl border border-[#173f35]/15 px-3" defaultValue={announcement.action_href ?? ""} name="action_href" /></label>
                <label className="block text-sm">Start / publish<input className="mt-2 min-h-11 w-full min-w-0 rounded-xl border border-[#173f35]/15 px-3" defaultValue={toDatetimeLocalValue(announcement.starts_at)} name="starts_at" type="datetime-local" /></label>
                <label className="block text-sm">Expiration<input className="mt-2 min-h-11 w-full min-w-0 rounded-xl border border-[#173f35]/15 px-3" defaultValue={toDatetimeLocalValue(announcement.ends_at)} name="ends_at" type="datetime-local" /></label>
                <AdminSaveButton idleLabel="Save edits" saved={notices.success === "saved"} />
              </form>
              <div className="mt-3 flex min-w-0 flex-wrap gap-2">
                {status !== "published" ? (
                  <form action={setCustomerAnnouncementStatus}>
                    <input name="id" type="hidden" value={announcement.id} />
                    <input name="status" type="hidden" value="published" />
                    <button className="min-h-11 rounded-xl bg-[#173f35] px-3 text-sm text-white" type="submit">Publish</button>
                  </form>
                ) : (
                  <form action={setCustomerAnnouncementStatus}>
                    <input name="id" type="hidden" value={announcement.id} />
                    <input name="status" type="hidden" value="draft" />
                    <button className="min-h-11 rounded-xl border border-[#173f35]/20 px-3 text-sm" type="submit">Unpublish</button>
                  </form>
                )}
                {status !== "archived" ? (
                  <form action={setCustomerAnnouncementStatus}>
                    <input name="id" type="hidden" value={announcement.id} />
                    <input name="status" type="hidden" value="archived" />
                    <button className="min-h-11 rounded-xl border border-[#173f35]/20 px-3 text-sm" type="submit">Archive</button>
                  </form>
                ) : null}
              </div>
            </article>
          );
        })}
      </div>
      <p className="text-sm text-[#6b6b6b]"><Link className="underline" href="/admin/content">Storefront billboard promotions</Link> remain separate from customer announcements.</p>
    </div>
  );
}
