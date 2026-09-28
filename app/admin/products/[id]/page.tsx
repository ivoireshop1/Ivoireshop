import { redirect } from "next/navigation";
import { requireAdmin } from "@/src/lib/auth/guards";
import { saveProduct } from "@/src/lib/catalog/actions";
import { categoriesForProductAssignment } from "@/src/lib/catalog/canonical-categories";
import { adminProductViewHref, adminProductViewLabel } from "@/src/lib/catalog/product-slug";
import { ProductForm } from "@/src/components/admin/catalog-form";
import Link from "next/link";

export const maxDuration = 60;

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
  if (!product) redirect("/admin/products?error=product_missing");

  const categoryOptions = categoriesForProductAssignment(categories ?? [], product.category_id);
  const viewHref = adminProductViewHref({ id: product.id, slug: product.slug, isActive: Boolean(product.is_active) });

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-3xl font-semibold text-forest-green">Edit product</h1>
        <Link
          className="min-h-11 rounded-full border border-[#173f35]/15 bg-white px-4 py-2 text-sm font-semibold text-[#173f35]"
          href={viewHref}
          target={product.is_active ? "_blank" : undefined}
        >
          {adminProductViewLabel(Boolean(product.is_active))}
        </Link>
      </div>
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
