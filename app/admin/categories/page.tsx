import { requireAdmin } from "@/src/lib/auth/guards";
import { createCategory, deactivateCategory, deleteCategory, updateCategory } from "@/src/lib/catalog/actions";
import { isCanonicalSlug } from "@/src/lib/catalog/canonical-categories";
import { CategoryCreateForm, CategoryRowForm } from "@/src/components/admin/category-forms";
import { AdminLoadFailure } from "@/src/components/admin/admin-load-failure";

export default async function AdminCategoriesPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; success?: string }>;
}) {
  const params = await searchParams;
  const { supabase } = await requireAdmin();
  const [{ data: categories, error }, { data: productRows }] = await Promise.all([
    supabase.from("categories").select("id, name, slug, description, image_url, is_active").order("name"),
    supabase.from("products").select("category_id, is_active"),
  ]);

  if (error) return <AdminLoadFailure message="Unable to load categories." title="Categories" />;

  const totals = new Map<string, number>();
  const actives = new Map<string, number>();
  (productRows ?? []).forEach((product) => {
    const key = product.category_id ?? "";
    totals.set(key, (totals.get(key) ?? 0) + 1);
    if (product.is_active) actives.set(key, (actives.get(key) ?? 0) + 1);
  });

  const rows = categories ?? [];
  const activeCategories = rows.filter((category) => category.is_active);
  const legacyCategories = rows.filter((category) => !category.is_active);

  return (
    <div className="space-y-6">
      <div>
        <p className="text-[11px] font-medium uppercase tracking-[0.24em] text-[#b8964c]">Organization</p>
        <h1 className="mt-2 text-3xl font-semibold text-[#173f35]">Categories</h1>
        <p className="mt-2 max-w-2xl text-sm text-[#6b6b6b]">
          Storefront shoppers see active categories. Counts include every product assigned to the category, including drafts.
        </p>
      </div>

      {params.error && (
        <p className="rounded-2xl border border-[#7f1d1d]/20 bg-[#7f1d1d]/5 px-4 py-3 text-sm text-[#7f1d1d]">
          {params.error === "category_in_use"
            ? "This category still has products assigned to it. Deactivate it instead of deleting."
            : params.error === "canonical_duplicate"
              ? "Cosmetics, Foods, and Ivoire Market already exist. Do not create a duplicate."
              : params.error === "canonical_locked"
                ? "The three primary categories cannot be renamed or deleted."
                : params.error === "category_duplicate"
                  ? "A category with that slug already exists."
                  : "The category could not be saved. Check the values and try again."}
        </p>
      )}
      {params.success && (
        <p className="rounded-2xl border border-[#173f35]/15 bg-[#173f35]/5 px-4 py-3 text-sm text-[#173f35]">
          Category changes saved.
        </p>
      )}

      <CategoryCreateForm action={createCategory} />

      <section className="space-y-4">
        <h2 className="text-lg font-semibold text-[#173f35]">Active categories</h2>
        {activeCategories.map((category) => (
          <CategoryRowForm
            activeCount={actives.get(category.id) ?? 0}
            category={category}
            deactivateAction={deactivateCategory}
            deleteAction={deleteCategory}
            isCanonical={isCanonicalSlug(category.slug)}
            key={category.id}
            totalCount={totals.get(category.id) ?? 0}
            updateAction={updateCategory}
          />
        ))}
      </section>

      <section className="space-y-4">
        <h2 className="text-lg font-semibold text-[#6b6b6b]">Legacy / inactive categories</h2>
        <p className="text-sm text-[#6b6b6b]">These are hidden from the storefront. They remain only if historical products still reference them.</p>
        {legacyCategories.length === 0 ? <p className="text-sm text-[#6b6b6b]">No inactive categories.</p> : null}
        {legacyCategories.map((category) => (
          <div className="opacity-80" key={category.id}>
            <CategoryRowForm
              activeCount={actives.get(category.id) ?? 0}
              category={category}
              deactivateAction={deactivateCategory}
              deleteAction={deleteCategory}
              isCanonical={isCanonicalSlug(category.slug)}
              totalCount={totals.get(category.id) ?? 0}
              updateAction={updateCategory}
            />
          </div>
        ))}
      </section>
    </div>
  );
}
