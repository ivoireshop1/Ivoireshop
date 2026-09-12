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
      {params.error && <p className="mt-4 rounded-lg bg-red-100 px-4 py-3 text-sm text-red-800">Enter a valid name, category, description, price, and whole-number stock quantity.</p>}
      <ProductForm action={saveProduct} categories={categories ?? []} />
    </>
  );
}
