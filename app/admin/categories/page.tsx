import { requireAdmin } from "@/src/lib/auth/guards";
import { createCategory, deleteCategory, updateCategory } from "@/src/lib/catalog/actions";

export default async function AdminCategoriesPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; success?: string }>;
}) {
  const params = await searchParams;
  const { supabase } = await requireAdmin();
  const { data: categories, error } = await supabase.from("categories").select("id, name, slug, description, is_active").order("name");
  if (error) throw new Error("Unable to load categories.");
  return (
    <>
      <h1 className="text-3xl font-semibold text-forest-green">Categories</h1>
      {params.error && <p className="mt-4 rounded-lg bg-red-100 px-4 py-3 text-sm text-red-800">The category could not be saved. Check the values and try again.</p>}
      {params.success && <p className="mt-4 rounded-lg bg-gold/15 px-4 py-3 text-sm text-forest-green">Category changes saved.</p>}
      <form action={createCategory} className="mt-6 grid gap-4 rounded-2xl bg-surface p-6 shadow-sm md:grid-cols-4">
        <input className="rounded-lg border border-black/15 px-4 py-3" name="name" placeholder="Category name" required />
        <input className="rounded-lg border border-black/15 px-4 py-3" name="slug" placeholder="Slug (optional)" />
        <input className="rounded-lg border border-black/15 px-4 py-3" name="description" placeholder="Description (optional)" />
        <button className="rounded-lg bg-forest-green px-4 py-3 font-medium text-white" type="submit">Add category</button>
      </form>
      <div className="mt-6 space-y-4">
        {(categories ?? []).map((category) => (
          <form action={updateCategory} className="grid gap-3 rounded-2xl bg-surface p-5 shadow-sm md:grid-cols-[1fr_1fr_2fr_auto_auto]" key={category.id}>
            <input name="id" type="hidden" value={category.id} />
            <input className="rounded-lg border border-black/15 px-3 py-2" name="name" defaultValue={category.name} required />
            <input className="rounded-lg border border-black/15 px-3 py-2" name="slug" defaultValue={category.slug} required />
            <input className="rounded-lg border border-black/15 px-3 py-2" name="description" defaultValue={category.description ?? ""} />
            <label className="flex items-center gap-2 text-sm"><input defaultChecked={category.is_active} name="is_active" type="checkbox" />Active</label>
            <div className="flex items-center gap-3">
              <button className="text-sm font-medium text-forest-green underline" type="submit">Save</button>
              <button className="text-sm font-medium text-red-700 underline" formAction={deleteCategory} type="submit">Delete</button>
            </div>
          </form>
        ))}
      </div>
    </>
  );
}
