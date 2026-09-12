import Image from "next/image";
import Link from "next/link";
import { requireAdmin } from "@/src/lib/auth/guards";
import {
  deleteProduct,
  duplicateProduct,
  toggleFeatured,
  updateProductStatus,
} from "@/src/lib/catalog/actions";

export default async function AdminProductsPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; success?: string; search?: string; status?: string; inventory?: string; category?: string; featured?: string }>;
}) {
  const params = await searchParams;
  const { supabase } = await requireAdmin();
  const searchQuery = (params.search ?? "").trim();
  const statusFilter = params.status ?? "all";
  const inventoryFilter = params.inventory ?? "all";
  const categoryFilter = params.category ?? "all";
  const featuredFilter = params.featured ?? "all";

  const [{ data: categories, error: categoriesError }, { data: products, error: productsError }] = await Promise.all([
    supabase.from("categories").select("id, name").eq("is_active", true).order("name"),
    supabase
      .from("products")
      .select("id, name, slug, price, stock_quantity, is_active, is_featured, created_at, category_id, categories(name), product_images(image_url, position)")
      .order("created_at", { ascending: false }),
  ]);

  if (categoriesError || productsError) {
    throw new Error("Unable to load product catalog.");
  }

  const filteredProducts = (products ?? []).filter((product) => {
    const nameMatches = !searchQuery || product.name.toLowerCase().includes(searchQuery.toLowerCase());
    const categoryMatches = categoryFilter === "all" || product.category_id === categoryFilter;
    const productStatus = getProductStatus(product);
    const statusMatches =
      statusFilter === "all" ||
      (statusFilter === "active" && productStatus === "Active") ||
      (statusFilter === "sold_out" && productStatus === "Sold Out") ||
      (statusFilter === "hidden" && productStatus === "Hidden");
    const inventoryMatches =
      inventoryFilter === "all" ||
      (inventoryFilter === "in_stock" && Number(product.stock_quantity) > 0) ||
      (inventoryFilter === "low_stock" && Number(product.stock_quantity) > 0 && Number(product.stock_quantity) <= 5) ||
      (inventoryFilter === "out_of_stock" && Number(product.stock_quantity) === 0);
    const featuredMatches =
      featuredFilter === "all" ||
      (featuredFilter === "featured" && product.is_featured) ||
      (featuredFilter === "not_featured" && !product.is_featured);

    return nameMatches && categoryMatches && statusMatches && inventoryMatches && featuredMatches;
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <p className="text-[11px] font-medium uppercase tracking-[0.24em] text-[#b8964c]">Catalog</p>
          <h1 className="mt-2 text-3xl font-semibold text-[#173f35]">Products</h1>
        </div>
        <div className="flex items-center gap-3">
          <Link
            className="rounded-full border border-[#173f35]/10 bg-white px-4 py-2 text-sm font-medium text-[#173f35] shadow-sm transition hover:border-[#173f35]/20"
            href="/admin/products"
          >
            Refresh
          </Link>
          <Link
            className="rounded-full bg-[#173f35] px-4 py-2 text-sm font-medium text-white shadow-[0_10px_22px_rgba(23,63,53,0.25)] transition hover:bg-[#143a30]"
            href="/admin/products/new"
          >
            Add Product
          </Link>
        </div>
      </div>

      <p className="text-sm text-[#6b6b6b]">
        Manage your store catalog, inventory, pricing and availability.
      </p>

      {params.error && (
        <p className="rounded-2xl border border-[#7f1d1d]/20 bg-[#7f1d1d]/5 px-4 py-3 text-sm text-[#7f1d1d]">
          The product action could not be completed. Check the values and try again.
        </p>
      )}
      {params.success && (
        <p className="rounded-2xl border border-[#173f35]/15 bg-[#173f35]/5 px-4 py-3 text-sm text-[#173f35]">
          Product changes saved.
        </p>
      )}

      <section className="rounded-[28px] border border-[#173f35]/10 bg-white p-4 shadow-[0_12px_32px_rgba(23,63,53,0.04)]">
        <form className="grid gap-3 lg:grid-cols-[1.4fr_repeat(3,minmax(0,1fr))_0.8fr_0.8fr]" method="get">
          <label className="block text-sm text-[#6b6b6b]">
            <span className="mb-2 block text-[11px] font-medium uppercase tracking-[0.2em] text-[#6b6b6b]">Search</span>
            <input
              className="w-full rounded-xl border border-[#173f35]/15 bg-[#f9f7f3] px-3 py-2.5 text-[#173f35] outline-none transition focus:border-[#173f35]/35"
              defaultValue={searchQuery}
              name="search"
              placeholder="Search products"
              type="search"
            />
          </label>

          <label className="block text-sm text-[#6b6b6b]">
            <span className="mb-2 block text-[11px] font-medium uppercase tracking-[0.2em] text-[#6b6b6b]">Status</span>
            <select className="w-full rounded-xl border border-[#173f35]/15 bg-[#f9f7f3] px-3 py-2.5 text-[#173f35] outline-none transition focus:border-[#173f35]/35" defaultValue={statusFilter} name="status">
              <option value="all">All Products</option>
              <option value="active">Active</option>
              <option value="sold_out">Sold Out</option>
              <option value="hidden">Hidden</option>
            </select>
          </label>

          <label className="block text-sm text-[#6b6b6b]">
            <span className="mb-2 block text-[11px] font-medium uppercase tracking-[0.2em] text-[#6b6b6b]">Inventory</span>
            <select className="w-full rounded-xl border border-[#173f35]/15 bg-[#f9f7f3] px-3 py-2.5 text-[#173f35] outline-none transition focus:border-[#173f35]/35" defaultValue={inventoryFilter} name="inventory">
              <option value="all">All Inventory</option>
              <option value="in_stock">In Stock</option>
              <option value="low_stock">Low Stock</option>
              <option value="out_of_stock">Out of Stock</option>
            </select>
          </label>

          <label className="block text-sm text-[#6b6b6b]">
            <span className="mb-2 block text-[11px] font-medium uppercase tracking-[0.2em] text-[#6b6b6b]">Category</span>
            <select className="w-full rounded-xl border border-[#173f35]/15 bg-[#f9f7f3] px-3 py-2.5 text-[#173f35] outline-none transition focus:border-[#173f35]/35" defaultValue={categoryFilter} name="category">
              <option value="all">All Categories</option>
              {(categories ?? []).map((category) => (
                <option key={category.id} value={category.id}>{category.name}</option>
              ))}
            </select>
          </label>

          <label className="block text-sm text-[#6b6b6b]">
            <span className="mb-2 block text-[11px] font-medium uppercase tracking-[0.2em] text-[#6b6b6b]">Featured</span>
            <select className="w-full rounded-xl border border-[#173f35]/15 bg-[#f9f7f3] px-3 py-2.5 text-[#173f35] outline-none transition focus:border-[#173f35]/35" defaultValue={featuredFilter} name="featured">
              <option value="all">All</option>
              <option value="featured">Featured</option>
              <option value="not_featured">Not Featured</option>
            </select>
          </label>

          <div className="flex items-end">
            <button className="w-full rounded-xl bg-[#173f35] px-4 py-2.5 text-sm font-medium text-white" type="submit">
              Apply
            </button>
          </div>
        </form>
      </section>

      <section className="rounded-[28px] border border-[#173f35]/10 bg-white p-4 shadow-[0_12px_32px_rgba(23,63,53,0.04)]">
        <div className="hidden items-center gap-3 border-b border-[#173f35]/10 px-3 pb-3 text-[11px] font-medium uppercase tracking-[0.18em] text-[#6b6b6b] md:grid md:grid-cols-[1.6fr_0.8fr_0.7fr_0.8fr_0.9fr_0.7fr_0.8fr]">
          <span>Product</span>
          <span>Category</span>
          <span>Price</span>
          <span>Inventory</span>
          <span>Status</span>
          <span>Featured</span>
          <span>Actions</span>
        </div>

        {filteredProducts.length === 0 ? (
          <div className="px-3 py-10 text-center">
            <p className="text-xl font-semibold text-[#173f35]">No products found</p>
            <p className="mt-2 text-sm text-[#6b6b6b]">Try adjusting your search or filters.</p>
          </div>
        ) : (
          <div className="space-y-4 pt-3">
            {filteredProducts.map((product) => {
              const nestedCategories = (product as { categories?: Array<{ name?: string }> | { name?: string } | null }).categories ?? null;
              const nestedImages = (product as { product_images?: Array<{ image_url?: string | null }> | null }).product_images ?? null;
              const categoryName = Array.isArray(nestedCategories)
                ? nestedCategories[0]?.name ?? "Uncategorized"
                : nestedCategories?.name ?? "Uncategorized";
              const imageUrl = Array.isArray(nestedImages)
                ? nestedImages[0]?.image_url ?? "/demo-products/premium-jasmine-rice.jpg"
                : "/demo-products/premium-jasmine-rice.jpg";
              const inventoryLabel = Number(product.stock_quantity) === 0 ? "Out of stock" : Number(product.stock_quantity) <= 5 ? "Low stock" : "In stock";

              return (
                <article key={product.id} className="rounded-2xl border border-[#173f35]/10 bg-[#f9f7f3] p-3 md:grid md:grid-cols-[1.6fr_0.8fr_0.7fr_0.8fr_0.9fr_0.7fr_0.8fr] md:items-center md:gap-3">
                  <div className="flex items-center gap-3">
                    <div className="h-14 w-14 overflow-hidden rounded-xl border border-[#173f35]/10 bg-white">
                      <Image alt={product.name} className="h-full w-full object-cover" height={56} src={imageUrl} unoptimized width={56} />
                    </div>
                    <div className="min-w-0">
                      <Link className="block truncate font-medium text-[#173f35] hover:underline" href={`/admin/products/${product.id}`}>
                        {product.name}
                      </Link>
                      <p className="mt-1 text-xs text-[#6b6b6b]">Updated {new Date(product.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</p>
                    </div>
                  </div>

                  <div className="mt-3 text-sm text-[#6b6b6b] md:mt-0">{categoryName}</div>
                  <div className="mt-3 text-sm font-medium text-[#173f35] md:mt-0">${Number(product.price).toFixed(2)}</div>
                  <div className="mt-3 md:mt-0">
                    <p className="text-sm font-medium text-[#173f35]">Stock: {product.stock_quantity}</p>
                    <p className="text-xs text-[#6b6b6b]">{inventoryLabel}</p>
                  </div>
                  <div className="mt-4 md:mt-0">
                    <form action={updateProductStatus}>
                      <input name="id" type="hidden" value={product.id} />
                      <select
                        className="w-full rounded-lg border border-[#173f35]/15 bg-white px-2 py-1.5 text-sm text-[#173f35]"
                        defaultValue={
                          product.is_active ? (Number(product.stock_quantity) === 0 ? "sold_out" : "active") : "hidden"
                        }
                        name="status"
                      >
                        <option value="active">Active</option>
                        <option value="sold_out">Sold Out</option>
                        <option value="hidden">Hidden</option>
                      </select>
                      <button className="mt-2 w-full rounded-lg bg-[#173f35] px-2 py-1.5 text-xs font-medium text-white" type="submit">
                        Update
                      </button>
                    </form>
                  </div>
                  <div className="mt-4 md:mt-0">
                    <form action={toggleFeatured}>
                      <input name="id" type="hidden" value={product.id} />
                      <button className={`w-full rounded-lg px-2 py-1.5 text-xs font-medium ${product.is_featured ? "bg-[#b8964c]/15 text-[#7c5d1a]" : "bg-[#173f35]/5 text-[#173f35]"}`} type="submit">
                        {product.is_featured ? "Featured" : "Not Featured"}
                      </button>
                    </form>
                  </div>
                  <div className="mt-4 flex flex-wrap items-center gap-2 md:mt-0">
                    <Link className="text-sm text-[#173f35] underline-offset-2 hover:underline" href={`/admin/products/${product.id}`}>
                      Edit
                    </Link>
                    <Link className="text-sm text-[#173f35] underline-offset-2 hover:underline" href={`/product/${product.slug}`} target="_blank">
                      View
                    </Link>
                    <form action={duplicateProduct}>
                      <input name="id" type="hidden" value={product.id} />
                      <button className="text-sm text-[#173f35] underline-offset-2 hover:underline" type="submit">
                        Duplicate
                      </button>
                    </form>
                    <form action={deleteProduct}>
                      <input name="id" type="hidden" value={product.id} />
                      <button className="text-sm text-[#7f1d1d] underline-offset-2 hover:underline" type="submit">
                        Delete
                      </button>
                    </form>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}

function getProductStatus(product: { stock_quantity: number; is_active: boolean }) {
  if (!product.is_active) return "Hidden";
  if (Number(product.stock_quantity) === 0) return "Sold Out";
  return "Active";
}
