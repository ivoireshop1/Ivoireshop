import Link from "next/link";
import { requireAdmin } from "@/src/lib/auth/guards";
import { deleteProduct } from "@/src/lib/catalog/actions";

export default async function AdminProductsPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; success?: string }>;
}) {
  const params = await searchParams;
  const { supabase } = await requireAdmin();
  const { data: products, error } = await supabase
    .from("products")
    .select("id, name, price, stock_quantity, is_active, is_featured")
    .order("created_at", { ascending: false })
    .limit(25);

  if (error) {
    throw new Error("Unable to load products.");
  }

  return (
    <>
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-3xl font-semibold text-forest-green">Products</h1>
        <Link
          className="rounded-lg bg-forest-green px-4 py-2 text-sm font-medium text-white"
          href="/admin/products/new"
        >
          Add product
        </Link>
      </div>
      {params.error && <p className="mt-4 rounded-lg bg-red-100 px-4 py-3 text-sm text-red-800">The product action could not be completed. Check the values and try again.</p>}
      {params.success && <p className="mt-4 rounded-lg bg-gold/15 px-4 py-3 text-sm text-forest-green">Product changes saved.</p>}
      <div className="mt-6 overflow-x-auto rounded-2xl bg-surface shadow-sm">
        <table className="w-full min-w-[620px] text-left text-sm">
          <thead className="border-b border-black/10 text-muted">
            <tr>
              <th className="px-5 py-4 font-medium">Name</th>
              <th className="px-5 py-4 font-medium">Price</th>
              <th className="px-5 py-4 font-medium">Stock</th>
              <th className="px-5 py-4 font-medium">Status</th>
            </tr>
          </thead>
          <tbody>
            {(products ?? []).map((product) => (
              <tr className="border-b border-black/5 last:border-0" key={product.id}>
                <td className="px-5 py-4 font-medium">{product.name}</td>
                <td className="px-5 py-4">${Number(product.price).toFixed(2)}</td>
                <td className="px-5 py-4">{product.stock_quantity}</td>
                <td className="px-5 py-4">{product.is_active ? "Active" : "Inactive"}{product.is_featured ? " · Featured" : ""}</td>
                <td className="px-5 py-4">
                  <div className="flex gap-3">
                    <Link className="text-forest-green underline" href={`/admin/products/${product.id}`}>Edit</Link>
                    <form action={deleteProduct}>
                      <input name="id" type="hidden" value={product.id} />
                      <button className="text-red-700 underline" type="submit">Delete</button>
                    </form>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
