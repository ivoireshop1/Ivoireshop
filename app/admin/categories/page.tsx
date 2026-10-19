import { requireAdmin } from "@/src/lib/auth/guards";
import { activateCategory, createCategory, deactivateCategory, deleteCategory, mergeOrReassignCategory, updateCategory } from "@/src/lib/catalog/actions";
import { isCanonicalSlug } from "@/src/lib/catalog/canonical-categories";
import { CategoryCreateForm, CategoryReassignForm, CategoryTreeManager } from "@/src/components/admin/category-forms";
import { AdminLoadFailure } from "@/src/components/admin/admin-load-failure";

const ERROR_COPY: Record<string, string> = {
  category_in_use: "This category still has products or subcategories. Hide it instead of deleting.",
  canonical_duplicate: "Cosmetics, Foods, and Ivoire Market already exist. Do not create a duplicate.",
  canonical_locked: "Primary storefront categories cannot be deleted or hidden.",
  category_parent_invalid: "Subcategories can only sit under a top-level category.",
  category_duplicate: "A category with that slug already exists.",
  category_name_duplicate: "A category with that name already exists at this level.",
  category_reassign_invalid: "Choose two different categories to reassign or merge.",
  category_required: "Enter a category name.",
  category_image_invalid: "Choose a valid category image.",
  category_create_failed: "The category could not be created. Check the values and try again.",
  category_update_failed: "The category could not be updated.",
  category_delete_failed: "The category could not be deleted.",
};

const SUCCESS_COPY: Record<string, string> = {
  category_created: "Category created.",
  subcategory_created: "Subcategory created.",
  category_updated: "Category updated.",
  category_deleted: "Category deleted.",
  category_reassigned: "Products were reassigned.",
};

export default async function AdminCategoriesPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; success?: string }>;
}) {
  const params = await searchParams;
  const { supabase } = await requireAdmin();
  const [{ data: categories, error }, { data: productRows }] = await Promise.all([
    supabase.from("categories").select("id, name, slug, description, image_url, is_active, parent_id, sort_order").order("sort_order").order("name"),
    supabase.from("products").select("category_id, subcategory_id, is_active"),
  ]);

  if (error) return <AdminLoadFailure message="Unable to load categories." title="Categories" />;

  const totals: Record<string, number> = {};
  const actives: Record<string, number> = {};
  for (const product of productRows ?? []) {
    if (product.category_id) {
      totals[product.category_id] = (totals[product.category_id] ?? 0) + 1;
      if (product.is_active) actives[product.category_id] = (actives[product.category_id] ?? 0) + 1;
    }
    if (product.subcategory_id) {
      totals[product.subcategory_id] = (totals[product.subcategory_id] ?? 0) + 1;
      if (product.is_active) actives[product.subcategory_id] = (actives[product.subcategory_id] ?? 0) + 1;
    }
  }

  const rows = categories ?? [];
  const parents = rows.filter((category) => !category.parent_id).map((category) => ({ id: category.id, name: category.name }));

  return (
    <div className="space-y-6">
      <div>
        <p className="text-[11px] font-medium uppercase tracking-[0.24em] text-[#b8964c]">Organization</p>
        <h1 className="mt-2 text-3xl font-semibold text-[#173f35]">Categories</h1>
        <p className="mt-2 max-w-2xl text-sm text-[#6b6b6b]">
          Manage parent categories and subcategories. Shoppers only see visible categories. Product assignments stay linked to these IDs.
        </p>
      </div>

      {params.error ? (
        <p className="rounded-2xl border border-[#7f1d1d]/20 bg-[#7f1d1d]/5 px-4 py-3 text-sm text-[#7f1d1d]">
          {ERROR_COPY[params.error] ?? "The category could not be saved. Check the values and try again."}
        </p>
      ) : null}
      {params.success ? (
        <p className="rounded-2xl border border-[#173f35]/15 bg-[#173f35]/5 px-4 py-3 text-sm text-[#173f35]">
          {SUCCESS_COPY[params.success] ?? "Category changes saved."}
        </p>
      ) : null}

      <CategoryCreateForm action={createCategory} parents={parents} title="Add new category" />

      <CategoryTreeManager
        activateAction={activateCategory}
        categories={rows}
        createAction={createCategory}
        deactivateAction={deactivateCategory}
        deleteAction={deleteCategory}
        isCanonicalSlug={isCanonicalSlug}
        productActives={actives}
        productTotals={totals}
        updateAction={updateCategory}
      />

      <CategoryReassignForm
        action={mergeOrReassignCategory}
        categories={rows.map((category) => ({ id: category.id, name: category.name, parent_id: category.parent_id }))}
      />
    </div>
  );
}
