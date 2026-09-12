import { notFound } from "next/navigation";
import { requireAdmin } from "@/src/lib/auth/guards";
import { saveProduct } from "@/src/lib/catalog/actions";
import { ProductForm } from "@/src/components/admin/catalog-form";

export default async function EditProductPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { supabase } = await requireAdmin();
  const [{ data: product, error: productError }, { data: categories, error: categoryError }] = await Promise.all([
    supabase.from("products").select("*").eq("id", id).maybeSingle(),
    supabase.from("categories").select("id, name").order("name"),
  ]);

  if (productError || categoryError) throw new Error("Unable to load product.");
  if (!product) notFound();

  return (
    <>
      <h1 className="text-3xl font-semibold text-forest-green">Edit product</h1>
      <ProductForm action={saveProduct} categories={categories ?? []} product={product} />
    </>
  );
}
