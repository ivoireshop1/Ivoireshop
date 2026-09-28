import { cache } from "react";
import { pageMetadata } from "@/src/lib/page-metadata";
import { SiteHeader } from "@/src/components/layout/site-header";
import { Footer } from "@/src/components/layout/footer";
import { notFound } from "next/navigation";
import { SmartBackButton } from "@/src/components/navigation/smart-back-button";
import { createClient } from "@/src/lib/supabase/server";
import { buildProductPath } from "@/src/lib/navigation/smart-navigation";
import { toOneRelation } from "@/src/lib/catalog/relation-utils";
import { publicStockLabel } from "@/src/lib/catalog/inventory";
import { ProductStorefrontDetail } from "@/src/components/product/product-storefront-detail";

const loadProduct = cache(async (slug: string) => {
  const supabase = await createClient();
  const { data: productRow, error } = await supabase
    .from("products")
    .select("id, name, slug, description, short_description, price, compare_at_price, stock_quantity, track_inventory, is_active, is_featured, is_new_arrival, is_coming_soon, category_id, categories(name), product_images(image_url, position)")
    .eq("slug", slug)
    .maybeSingle();

  if (error) return null;
  return productRow;
});

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const product = await loadProduct(slug);
  if (!product) return { title: "Product unavailable", robots: { index: false } };
  const metadata = pageMetadata(product.name, product.short_description || product.description, `/product/${encodeURIComponent(slug)}`);
  const image = product.product_images?.slice().sort((a, b) => a.position - b.position)[0]?.image_url;
  return { ...metadata, openGraph: { ...metadata.openGraph, images: image ? [{ url: image, alt: product.name }] : [] } };
}

export default async function ProductPage({ params, searchParams }: { params: Promise<{ slug: string }>; searchParams: Promise<{ returnTo?: string }> }) {
  const { slug } = await params;
  const { returnTo } = await searchParams;
  const supabase = await createClient();
  const productRow = await loadProduct(slug);

  if (!productRow) notFound();

  const primaryImage = productRow.product_images?.slice().sort((a, b) => a.position - b.position)[0]?.image_url;
  const isComingSoon = Boolean(productRow.is_coming_soon) && !productRow.is_active;
  if (!productRow.is_active && !isComingSoon) notFound();
  if (isComingSoon && !primaryImage) notFound();

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
    isNew: Boolean(productRow.is_new_arrival) && Boolean(productRow.is_active),
    isPopular: false,
    isComingSoon,
  };

  const [{ data: relatedRows }, { data: reviewSummary }, { data: reviews }, { data: { user } }] = await Promise.all([
    supabase
    .from("products")
    .select("id, name, slug, price, compare_at_price, description, short_description, is_featured, stock_quantity, track_inventory, categories(name), product_images(image_url, position)")
    .eq("is_active", true)
    .neq("id", product.id)
    .eq("category_id", productRow.category_id)
    .order("created_at", { ascending: false })
    .limit(4),
    supabase.from("product_review_summaries").select("average_rating, review_count").eq("product_id", product.id).maybeSingle(),
    supabase.from("product_reviews").select("id, rating, review_text, review_title, display_name, verified_purchase, created_at").eq("product_id", product.id).eq("status", "published").order("created_at", { ascending: false }).limit(20),
    supabase.auth.getUser(),
  ]);

  const ownReviewResult = user
    ? await supabase.from("product_reviews").select("rating, review_text, review_title, status").eq("product_id", product.id).eq("user_id", user.id).maybeSingle()
    : { data: null };
  const ownReview = ownReviewResult.data;

  const related = (relatedRows ?? []).map((item) => {
    const image = item.product_images?.slice().sort((a, b) => a.position - b.position)[0]?.image_url;
    return image ? {
    id: item.id,
    slug: item.slug,
    name: item.name,
    description: item.description,
    shortDescription: item.short_description ?? item.description,
    price: Number(item.price),
    compareAtPrice: item.compare_at_price === null ? undefined : Number(item.compare_at_price),
    category: toOneRelation(item.categories)?.name || "Uncategorized",
    image,
    weight: publicStockLabel(item.track_inventory, item.stock_quantity),
    stockQuantity: item.stock_quantity,
    trackInventory: item.track_inventory !== false,
    isFeatured: Boolean(item.is_featured),
    isNew: false,
    isPopular: false,
  } : null;
  }).filter((item): item is NonNullable<typeof item> => item !== null);

  const currentProductPath = buildProductPath(product.slug);
  return (
    <>
      <SiteHeader />
      <div className="mx-auto max-w-7xl px-5 pt-6 lg:px-8">
        <SmartBackButton />
      </div>
      <ProductStorefrontDetail
        isAuthenticated={Boolean(user)}
        ownReview={ownReview}
        product={product}
        related={related}
        returnTo={returnTo ?? currentProductPath}
        reviews={reviews ?? []}
        reviewSummary={reviewSummary}
      />
      <Footer />
    </>
  );
}
