import { notFound } from "next/navigation";
import { requireAdmin } from "@/src/lib/auth/guards";
import { saveProduct } from "@/src/lib/catalog/actions";
import { categoriesForProductAssignment } from "@/src/lib/catalog/canonical-categories";
import { ProductForm } from "@/src/components/admin/catalog-form";

export default async function EditProductPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { id } = await params;
  const { error: queryError } = await searchParams;
  const { supabase } = await requireAdmin();
  const [{ data: product, error: productError }, { data: categories, error: categoryError }] = await Promise.all([
    supabase.from("products").select("*, product_images(image_url, position)").eq("id", id).maybeSingle(),
    supabase.from("categories").select("id, name, slug, is_active").order("name"),
  ]);

  if (productError || categoryError) throw new Error("Unable to load product.");
  if (!product) notFound();

  const categoryOptions = categoriesForProductAssignment(categories ?? [], product.category_id);

  return (
    <>
      <h1 className="text-3xl font-semibold text-forest-green">Edit product</h1>
      {queryError && (
        <p className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-800">
          {queryError === "missing_category"
            ? "Add a category before publishing."
            : queryError === "missing_image"
              ? "Add at least one product image before publishing."
              : queryError === "missing_price"
                ? "Add a price before publishing."
                : queryError === "missing_stock"
                  ? "Add a valid stock quantity before publishing."
                  : queryError === "missing_name"
                    ? "Add a product name before publishing."
                    : "Enter a valid name, category, description, price, and whole-number stock quantity."}
        </p>
      )}
      <ProductForm action={saveProduct} categories={categoryOptions} product={product} />
    </>
  );
}
