import { requireAdmin } from "@/src/lib/auth/guards";
import { createCategory, deleteCategory, updateCategory } from "@/src/lib/catalog/actions";

export default async function AdminCategoriesPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; success?: string }>;
}) {
  const params = await searchParams;
  const { supabase } = await requireAdmin();
  const [{ data: categories, error }, { data: productCounts }] = await Promise.all([
    supabase.from("categories").select("id, name, slug, description, image_url, is_active").order("name"),
    supabase.from("products").select("category_id"),
  ]);

  if (error) throw new Error("Unable to load categories.");

  const counts = new Map<string, number>();
  (productCounts ?? []).forEach((product) => {
    const key = product.category_id ?? "";
    counts.set(key, (counts.get(key) ?? 0) + 1);
  });

  return (
    <div className="space-y-6">
      <div>
        <p className="text-[11px] font-medium uppercase tracking-[0.24em] text-[#b8964c]">Organization</p>
        <h1 className="mt-2 text-3xl font-semibold text-[#173f35]">Categories</h1>
      </div>

      {params.error && (
        <p className="rounded-2xl border border-[#7f1d1d]/20 bg-[#7f1d1d]/5 px-4 py-3 text-sm text-[#7f1d1d]">
          {params.error === "category_in_use" ? "This category still has products assigned to it. Move or reassign them before deleting it." : "The category could not be saved. Check the values and try again."}
        </p>
      )}
      {params.success && (
        <p className="rounded-2xl border border-[#173f35]/15 bg-[#173f35]/5 px-4 py-3 text-sm text-[#173f35]">
          Category changes saved.
        </p>
      )}

      <form action={createCategory} className="grid gap-4 rounded-[28px] border border-[#173f35]/10 bg-white p-6 shadow-[0_12px_32px_rgba(23,63,53,0.04)] lg:grid-cols-5">
        <input className="rounded-xl border border-[#173f35]/15 px-4 py-3" name="name" placeholder="Category name" required />
        <input className="rounded-xl border border-[#173f35]/15 px-4 py-3" name="slug" placeholder="Slug (optional)" />
        <input className="rounded-xl border border-[#173f35]/15 px-4 py-3" name="image_url" placeholder="Image URL (optional)" />
        <input className="rounded-xl border border-[#173f35]/15 px-4 py-3 lg:col-span-1" name="description" placeholder="Description" />
        <div className="flex items-center justify-end gap-3">
          <label className="flex items-center gap-2 text-sm text-[#173f35]">
            <input defaultChecked name="is_active" type="checkbox" />
            Active
          </label>
          <button className="rounded-xl bg-[#173f35] px-4 py-3 text-sm font-medium text-white" type="submit">Add category</button>
        </div>
      </form>

      <div className="space-y-4">
        {(categories ?? []).map((category) => (
          <form action={updateCategory} className="grid gap-3 rounded-[24px] border border-[#173f35]/10 bg-white p-5 shadow-[0_10px_25px_rgba(23,63,53,0.04)] lg:grid-cols-[1.2fr_1.2fr_1.2fr_1.5fr_auto_auto_auto]" key={category.id}>
            <input name="id" type="hidden" value={category.id} />
            <input className="rounded-xl border border-[#173f35]/15 px-3 py-2" name="name" defaultValue={category.name} required />
            <input className="rounded-xl border border-[#173f35]/15 px-3 py-2" name="slug" defaultValue={category.slug} required />
            <input className="rounded-xl border border-[#173f35]/15 px-3 py-2" name="image_url" defaultValue={category.image_url ?? ""} placeholder="Image URL" />
            <input className="rounded-xl border border-[#173f35]/15 px-3 py-2" name="description" defaultValue={category.description ?? ""} placeholder="Description" />
            <label className="flex items-center gap-2 text-sm text-[#173f35]">
              <input defaultChecked={category.is_active} name="is_active" type="checkbox" />
              Active
            </label>
            <div className="flex items-center justify-center text-sm text-[#6b6b6b]">
              {counts.get(category.id) ?? 0} products
            </div>
            <div className="flex items-center gap-3">
              <button className="text-sm font-medium text-[#173f35] underline-offset-2 hover:underline" type="submit">Save</button>
              <button className="text-sm font-medium text-[#7f1d1d] underline-offset-2 hover:underline" formAction={deleteCategory} type="submit">Delete</button>
            </div>
          </form>
        ))}
      </div>
    </div>
  );
}
