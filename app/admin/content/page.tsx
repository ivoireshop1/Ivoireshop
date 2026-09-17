import { requireAdmin } from "@/src/lib/auth/guards";
import { createAnnouncement, listAnnouncements } from "@/src/lib/admin/announcements";
import { createClient } from "@/src/lib/supabase/server";

export default async function AdminContentPage() {
  await requireAdmin();
  const announcements = await listAnnouncements();
  const supabase = await createClient();
  const { data: products } = await supabase
    .from("products")
    .select("id, name, slug")
    .eq("is_active", true)
    .order("name");

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-3xl font-semibold text-[#173f35]">Storefront announcements</h1>
      </div>

      <div className="rounded-2xl border border-[#173f35]/10 bg-white p-6 shadow-[0_12px_32px_rgba(23,63,53,0.05)]">
        <form action={createAnnouncement} className="grid gap-4 md:grid-cols-2">
          <label className="block text-sm font-medium text-[#173f35] md:col-span-2">
            Title
            <input className="mt-2 w-full rounded-xl border border-[#173f35]/15 bg-white px-4 py-3" name="title" required />
          </label>

          <label className="block text-sm font-medium text-[#173f35] md:col-span-2">
            Description
            <textarea className="mt-2 min-h-24 w-full rounded-xl border border-[#173f35]/15 bg-white px-4 py-3" name="description" required />
          </label>

          <label className="block text-sm font-medium text-[#173f35]">
            Badge / status
            <input className="mt-2 w-full rounded-xl border border-[#173f35]/15 bg-white px-4 py-3" defaultValue="New" name="badge" />
          </label>

          <label className="block text-sm font-medium text-[#173f35]">
            CTA label
            <input className="mt-2 w-full rounded-xl border border-[#173f35]/15 bg-white px-4 py-3" defaultValue="Shop now" name="cta_label" />
          </label>

          <label className="block text-sm font-medium text-[#173f35] md:col-span-2">
            CTA destination URL
            <input className="mt-2 w-full rounded-xl border border-[#173f35]/15 bg-white px-4 py-3" name="cta_destination" placeholder="/shop or /product/slug" />
          </label>

          <label className="block text-sm font-medium text-[#173f35]">
            Product association
            <select className="mt-2 w-full rounded-xl border border-[#173f35]/15 bg-white px-4 py-3" name="product_id">
              <option value="">No product</option>
              {(products ?? []).map((product) => <option key={product.id} value={product.id}>{product.name}</option>)}
            </select>
          </label>

          <label className="block text-sm font-medium text-[#173f35]">
            Image URL
            <input className="mt-2 w-full rounded-xl border border-[#173f35]/15 bg-white px-4 py-3" name="image_url" placeholder="https://..." />
          </label>

          <label className="block text-sm font-medium text-[#173f35]">
            Priority
            <input className="mt-2 w-full rounded-xl border border-[#173f35]/15 bg-white px-4 py-3" defaultValue="0" name="priority" type="number" />
          </label>

          <label className="block text-sm font-medium text-[#173f35]">
            Starts at
            <input className="mt-2 w-full rounded-xl border border-[#173f35]/15 bg-white px-4 py-3" name="starts_at" type="datetime-local" />
          </label>

          <label className="block text-sm font-medium text-[#173f35]">
            Ends at
            <input className="mt-2 w-full rounded-xl border border-[#173f35]/15 bg-white px-4 py-3" name="ends_at" type="datetime-local" />
          </label>

          <label className="flex items-center gap-2 text-sm font-medium text-[#173f35]">
            <input defaultChecked name="is_published" type="checkbox" />
            Publish now
          </label>

          <button className="rounded-xl bg-[#173f35] px-4 py-3 text-sm font-semibold text-white md:col-span-2" type="submit">
            Save announcement
          </button>
        </form>
      </div>

      <div className="rounded-2xl border border-[#173f35]/10 bg-white p-6 shadow-[0_12px_32px_rgba(23,63,53,0.05)]">
        <h2 className="text-xl font-semibold text-[#173f35]">Current announcements</h2>
        <div className="mt-4 space-y-3">
          {announcements.length ? announcements.map((announcement) => (
            <div className="rounded-xl border border-[#173f35]/10 bg-[#f8f5f0] p-4" key={announcement.id}>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="rounded-full bg-[#173f35] px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.15em] text-white">{announcement.badge}</span>
                <span className="text-xs text-[#6b6b6b]">{announcement.is_published ? "Published" : "Draft"}</span>
              </div>
              <h3 className="mt-3 text-lg font-semibold text-[#173f35]">{announcement.title}</h3>
              <p className="mt-2 text-sm text-[#6b6b6b]">{announcement.description}</p>
            </div>
          )) : <p className="text-sm text-[#6b6b6b]">No storefront announcements yet.</p>}
        </div>
      </div>
    </div>
  );
}
