import { requireAdmin } from "@/src/lib/auth/guards";
import { saveProduct } from "@/src/lib/catalog/actions";
import { ProductForm } from "@/src/components/admin/catalog-form";

export default async function NewProductPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { supabase } = await requireAdmin();
  const params = await searchParams;
  const { data: categories, error } = await supabase.from("categories").select("id, name").eq("is_active", true).order("name");

  if (error) throw new Error("Unable to load product categories.");

  return (
    <>
      <h1 className="text-3xl font-semibold text-forest-green">Add product</h1>
      {params.error && (
        <p className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-800">
          {params.error === "missing_category"
            ? "Add a category before publishing."
            : params.error === "missing_image"
              ? "Add at least one product image before publishing."
              : params.error === "missing_price"
                ? "Add a valid price before publishing."
                : params.error === "missing_stock"
                  ? "Add a valid stock quantity before publishing."
                  : params.error === "missing_name"
                    ? "Add a product name before publishing."
                    : "Enter a valid name, category, description, price, and whole-number stock quantity."}
        </p>
      )}
      <ProductForm action={saveProduct} categories={categories ?? []} />
    </>
  );
}
