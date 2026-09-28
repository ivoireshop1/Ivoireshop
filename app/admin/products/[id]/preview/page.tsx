import { redirect } from "next/navigation";
import { pageMetadata } from "@/src/lib/page-metadata";
import { requireAdmin } from "@/src/lib/auth/guards";
import { toOneRelation } from "@/src/lib/catalog/relation-utils";
import { publicStockLabel } from "@/src/lib/catalog/inventory";
import { ProductStorefrontDetail } from "@/src/components/product/product-storefront-detail";

export const metadata = pageMetadata("Product preview", "Admin-only unpublished product preview.", "/admin", false);

export default async function AdminProductPreviewPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { supabase } = await requireAdmin();
  const { data: productRow, error } = await supabase
    .from("products")
    .select("id, name, slug, description, short_description, price, compare_at_price, stock_quantity, track_inventory, is_active, is_featured, is_new_arrival, is_coming_soon, category_id, categories(name), product_images(image_url, position)")
    .eq("id", id)
    .maybeSingle();

  if (error || !productRow) {
    redirect("/admin/products?error=product_missing");
  }

  const primaryImage = productRow.product_images?.slice().sort((a, b) => a.position - b.position)[0]?.image_url;
  const product = {
    id: productRow.id,
    slug: productRow.slug,
    name: productRow.name,
    description: productRow.description ?? "",
    shortDescription: productRow.short_description ?? productRow.description ?? "",
    price: Number(productRow.price),
    compareAtPrice: productRow.compare_at_price === null ? undefined : Number(productRow.compare_at_price),
    category: toOneRelation(productRow.categories)?.name || "Uncategorized",
    image: primaryImage ?? "",
    weight: publicStockLabel(productRow.track_inventory, productRow.stock_quantity),
    stockQuantity: productRow.stock_quantity,
    trackInventory: productRow.track_inventory !== false,
    isFeatured: Boolean(productRow.is_featured),
    isNew: Boolean(productRow.is_new_arrival),
    isPopular: false,
    isComingSoon: Boolean(productRow.is_coming_soon) && !productRow.is_active,
  };

  return (
    <ProductStorefrontDetail
      editHref={`/admin/products/${product.id}`}
      isAuthenticated
      mode="preview"
      ownReview={null}
      product={product}
      related={[]}
      returnTo={`/admin/products/${product.id}`}
      reviews={[]}
      reviewSummary={null}
    />
  );
}
