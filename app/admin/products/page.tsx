import Link from "next/link";
import { AdminProductsManager } from "@/src/components/admin/admin-products-manager";
import { requireAdmin } from "@/src/lib/auth/guards";
import { deleteProduct, duplicateProduct } from "@/src/lib/catalog/actions";
import { matchesAdminReviewFilter } from "@/src/lib/catalog/admin-product-filters";
import { categoriesForProductAssignment } from "@/src/lib/catalog/canonical-categories";
import { isPersistentImageUrl } from "@/src/lib/catalog/image-url";

export default async function AdminProductsPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; success?: string; search?: string; status?: string; inventory?: string; category?: string; featured?: string; review?: string }>;
}) {
  const params = await searchParams;
  const { supabase } = await requireAdmin();
  const searchQuery = (params.search ?? "").trim();
  const statusFilter = params.status ?? "all";
  const inventoryFilter = params.inventory ?? "all";
  const categoryFilter = params.category ?? "all";
  const featuredFilter = params.featured ?? "all";
  const reviewFilter = params.review ?? "all";

  const [{ data: categories, error: categoriesError }, { data: products, error: productsError }] = await Promise.all([
    supabase.from("categories").select("id, name, slug, is_active").order("name"),
    supabase
      .from("products")
      .select("id, name, slug, price, stock_quantity, track_inventory, is_active, is_featured, is_coming_soon, needs_pricing, needs_category_review, created_at, category_id, categories(name), product_images(image_url, position)")
      .order("created_at", { ascending: false }),
  ]);

  if (categoriesError || productsError) {
    throw new Error("Unable to load product catalog.");
  }

  const assignmentCategories = categoriesForProductAssignment(categories ?? []);

  const filteredProducts = (products ?? []).filter((product) => {
    const nameMatches = !searchQuery || product.name.toLowerCase().includes(searchQuery.toLowerCase());
    const categoryMatches = categoryFilter === "all" || product.category_id === categoryFilter;
    const productStatus = product.is_active ? "Active" : "Draft";
    const statusMatches =
      statusFilter === "all" ||
      (statusFilter === "active" && productStatus === "Active") ||
      (statusFilter === "draft" && productStatus === "Draft");
    const inventoryMatches =
      inventoryFilter === "all" ||
      (inventoryFilter === "needs_pricing" && (product.needs_pricing || product.price === null)) ||
      (inventoryFilter === "needs_stock" && product.track_inventory !== false && product.stock_quantity === null) ||
      (inventoryFilter === "untracked" && product.track_inventory === false) ||
      (inventoryFilter === "in_stock" && product.track_inventory !== false && Number(product.stock_quantity) > 0) ||
      (inventoryFilter === "out_of_stock" && product.track_inventory !== false && Number(product.stock_quantity) === 0);
    const featuredMatches =
      featuredFilter === "all" ||
      (featuredFilter === "featured" && product.is_featured) ||
      (featuredFilter === "not_featured" && !product.is_featured);
    const nestedImages = (product as { product_images?: Array<{ image_url?: string | null }> | null }).product_images ?? null;
    const nestedCategories = (product as { categories?: Array<{ name?: string }> | { name?: string } | null }).categories ?? null;
    const categoryName = Array.isArray(nestedCategories)
      ? nestedCategories[0]?.name ?? "Uncategorized"
      : nestedCategories?.name ?? "Uncategorized";
    const imageUrl = Array.isArray(nestedImages) ? nestedImages[0]?.image_url ?? null : null;
    const reviewMatches = matchesAdminReviewFilter(reviewFilter, {
      name: product.name,
      categoryId: product.category_id,
      categoryName,
      price: product.price,
      stockQuantity: product.stock_quantity,
      trackInventory: product.track_inventory,
      needsCategoryReview: product.needs_category_review,
      isActive: product.is_active,
      isComingSoon: product.is_coming_soon,
      needsPricing: product.needs_pricing,
      imageUrl,
      images: nestedImages,
    });

    return nameMatches && categoryMatches && statusMatches && inventoryMatches && featuredMatches && reviewMatches;
  });

  const rows = filteredProducts.map((product) => {
    const nestedCategories = (product as { categories?: Array<{ name?: string }> | { name?: string } | null }).categories ?? null;
    const nestedImages = (product as { product_images?: Array<{ image_url?: string | null }> | null }).product_images ?? null;
    const categoryName = Array.isArray(nestedCategories)
      ? nestedCategories[0]?.name ?? "Uncategorized"
      : nestedCategories?.name ?? "Uncategorized";
    const imageUrl = Array.isArray(nestedImages) ? nestedImages[0]?.image_url ?? null : null;
    return {
      id: product.id,
      name: product.name,
      slug: product.slug,
      createdAt: product.created_at,
      categoryName,
      imageUrl,
      price: product.price,
      stockQuantity: product.stock_quantity,
      trackInventory: product.track_inventory !== false,
      isActive: product.is_active,
      isFeatured: product.is_featured,
      hasImage: Boolean(imageUrl && isPersistentImageUrl(imageUrl)),
      hasCategory: Boolean(product.category_id) && categoryName !== "Uncategorized",
    };
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
      <p className="flex flex-wrap gap-x-3 gap-y-2 text-sm">
        <Link className="font-semibold text-[#173f35] underline underline-offset-4" href="/admin/products?review=needs-review">Needs review</Link>
        <Link className="font-semibold text-[#173f35] underline underline-offset-4" href="/admin/products?review=category">Needs category review</Link>
        <Link className="font-semibold text-[#173f35] underline underline-offset-4" href="/admin/products?review=missing_price">Missing price</Link>
        <Link className="font-semibold text-[#173f35] underline underline-offset-4" href="/admin/products?review=missing_image">Missing image</Link>
        <Link className="font-semibold text-[#173f35] underline underline-offset-4" href="/admin/products?review=inventory">Inventory issue</Link>
        <Link className="font-semibold text-[#173f35] underline underline-offset-4" href="/admin/products?review=draft">Draft</Link>
        <Link className="font-semibold text-[#173f35] underline underline-offset-4" href="/admin/products?review=coming_soon">Coming Soon</Link>
        <Link className="font-semibold text-[#173f35] underline underline-offset-4" href="/admin/products">All products</Link>
      </p>

      {params.error && (
        <p className="rounded-2xl border border-[#7f1d1d]/20 bg-[#7f1d1d]/5 px-4 py-3 text-sm font-medium text-[#7f1d1d]">
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
                    : "The product action could not be completed. Check the values and try again."}
        </p>
      )}
      {params.success && (
        <p className="rounded-2xl border border-[#173f35]/15 bg-[#173f35]/5 px-4 py-3 text-sm font-medium text-[#173f35]">
          Product changes saved.
        </p>
      )}

      <section className="rounded-[28px] border border-[#173f35]/10 bg-white p-4 shadow-[0_12px_32px_rgba(23,63,53,0.04)]">
        <form className="grid gap-3 lg:grid-cols-[1.4fr_repeat(3,minmax(0,1fr))_0.8fr_0.8fr]" method="get">
          {reviewFilter !== "all" ? <input name="review" type="hidden" value={reviewFilter} /> : null}
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
              <option value="draft">Draft</option>
            </select>
          </label>

          <label className="block text-sm text-[#6b6b6b]">
            <span className="mb-2 block text-[11px] font-medium uppercase tracking-[0.2em] text-[#6b6b6b]">Inventory</span>
            <select className="w-full rounded-xl border border-[#173f35]/15 bg-[#f9f7f3] px-3 py-2.5 text-[#173f35] outline-none transition focus:border-[#173f35]/35" defaultValue={inventoryFilter} name="inventory">
              <option value="all">All Inventory</option>
              <option value="needs_pricing">Needs pricing</option>
              <option value="needs_stock">Needs stock</option>
              <option value="untracked">Not tracked</option>
              <option value="in_stock">In Stock</option>
              <option value="out_of_stock">Out of Stock</option>
            </select>
          </label>

          <label className="block text-sm text-[#6b6b6b]">
            <span className="mb-2 block text-[11px] font-medium uppercase tracking-[0.2em] text-[#6b6b6b]">Category</span>
            <select className="w-full rounded-xl border border-[#173f35]/15 bg-[#f9f7f3] px-3 py-2.5 text-[#173f35] outline-none transition focus:border-[#173f35]/35" defaultValue={categoryFilter} name="category">
              <option value="all">All Categories</option>
              {assignmentCategories.map((category) => (
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

      <section className="overflow-x-hidden rounded-[28px] border border-[#173f35]/10 bg-white p-4 shadow-[0_12px_32px_rgba(23,63,53,0.04)]">
        <AdminProductsManager deleteAction={deleteProduct} duplicateAction={duplicateProduct} products={rows} />
      </section>
    </div>
  );
}
