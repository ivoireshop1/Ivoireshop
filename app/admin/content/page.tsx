import Link from "next/link";
import { requireAdmin } from "@/src/lib/auth/guards";
import { createAnnouncement, deleteAnnouncement, listAnnouncements, setAnnouncementPublished } from "@/src/lib/admin/announcements";
import { CategoryImageField } from "@/src/components/admin/category-image-field";
import { ConfirmSubmitButton } from "@/src/components/admin/confirm-submit-button";

export default async function AdminContentPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; success?: string }>;
}) {
  await requireAdmin();
  const announcements = await listAnnouncements();
  const { error, success } = await searchParams;

  return (
    <div className="space-y-6">
      <div>
        <p className="text-[11px] font-medium uppercase tracking-[0.22em] text-[#b8964c]">Merchandising</p>
        <h1 className="mt-2 text-3xl font-semibold text-[#173f35]">Storefront / Promotions</h1>
        <p className="mt-2 text-sm text-[#6b6b6b]">One published billboard can appear on the storefront. Disable it to return to the regular layout.</p>
        <Link className="mt-3 inline-flex min-h-11 items-center text-sm font-semibold text-[#173f35] underline underline-offset-4" href="/admin/products/catalog-controls">
          Catalog Controls
        </Link>
      </div>
      {error ? <p className="rounded-2xl border border-[#7f1d1d]/20 bg-[#7f1d1d]/5 px-4 py-3 text-sm text-[#7f1d1d]">The promotion could not be saved. Use an internal link such as /shop or /shop?arrival=new.</p> : null}
      {success ? <p className="rounded-2xl border border-[#173f35]/15 bg-[#173f35]/5 px-4 py-3 text-sm text-[#173f35]">Promotion updated.</p> : null}

      <div className="rounded-2xl border border-[#173f35]/10 bg-white p-6 shadow-[0_12px_32px_rgba(23,63,53,0.05)]">
        <form action={createAnnouncement} className="grid gap-4">
          <label className="block text-sm font-medium text-[#173f35]">
            Eyebrow / small label
            <input className="mt-2 min-h-11 w-full rounded-xl border border-[#173f35]/15 px-4 py-3" defaultValue="New this week" name="badge" />
          </label>
          <label className="block text-sm font-medium text-[#173f35]">
            Headline
            <input className="mt-2 min-h-11 w-full rounded-xl border border-[#173f35]/15 px-4 py-3" name="title" required />
          </label>
          <label className="block text-sm font-medium text-[#173f35]">
            Description
            <textarea className="mt-2 min-h-24 w-full rounded-xl border border-[#173f35]/15 px-4 py-3" name="description" required />
          </label>
          <label className="block text-sm font-medium text-[#173f35]">
            Button label
            <input className="mt-2 min-h-11 w-full rounded-xl border border-[#173f35]/15 px-4 py-3" defaultValue="Shop new arrivals" name="cta_label" />
          </label>
          <label className="block text-sm font-medium text-[#173f35]">
            Button destination
            <input className="mt-2 min-h-11 w-full rounded-xl border border-[#173f35]/15 px-4 py-3" defaultValue="/shop?arrival=new" name="cta_destination" />
            <span className="mt-1 block text-xs text-[#6b6b6b]">Internal paths only, for example /shop, /categories, or /product/slug.</span>
          </label>
          <CategoryImageField emptyHint="Upload a billboard image from your gallery. The storefront stays complete if this is left empty." />
          <label className="flex min-h-11 items-center gap-2 text-sm font-medium text-[#173f35]">
            <input name="is_published" type="checkbox" />
            Publish now
          </label>
          <button className="min-h-11 rounded-xl bg-[#173f35] px-4 py-3 text-sm font-semibold text-white" type="submit">
            Save promotion
          </button>
        </form>
      </div>

      <div className="space-y-3">
        {announcements.length ? announcements.map((announcement) => (
          <article className="rounded-2xl border border-[#173f35]/10 bg-white p-5" key={announcement.id}>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="rounded-full bg-[#173f35] px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.15em] text-white">{announcement.badge}</span>
              <span className="text-xs text-[#6b6b6b]">{announcement.is_published ? "Published" : "Inactive"}</span>
            </div>
            <h2 className="mt-3 text-lg font-semibold text-[#173f35]">{announcement.title}</h2>
            <p className="mt-2 text-sm text-[#6b6b6b]">{announcement.description}</p>
            <p className="mt-2 text-xs text-[#6b6b6b]">{announcement.cta_label} → {announcement.cta_destination}</p>
            <div className="mt-4 flex flex-wrap gap-3">
              <form action={setAnnouncementPublished}>
                <input name="id" type="hidden" value={announcement.id} />
                <input name="is_published" type="hidden" value={announcement.is_published ? "false" : "true"} />
                <button className="min-h-11 text-sm font-semibold text-[#173f35] underline underline-offset-4" type="submit">
                  {announcement.is_published ? "Disable" : "Publish"}
                </button>
              </form>
              <form action={deleteAnnouncement}>
                <input name="id" type="hidden" value={announcement.id} />
                <ConfirmSubmitButton className="min-h-11 text-sm font-semibold text-[#7f1d1d] underline underline-offset-4" label="Delete" message="Delete this promotion?" />
              </form>
            </div>
          </article>
        )) : <p className="text-sm text-[#6b6b6b]">No promotions yet. The storefront still looks complete without one.</p>}
      </div>
    </div>
  );
}
