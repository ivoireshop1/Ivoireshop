import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AddToCart } from "@/src/components/product/add-to-cart";
import { SmartBackButton } from "@/src/components/navigation/smart-back-button";
import { RelatedProducts } from "@/src/components/product/related-products";
import { createClient } from "@/src/lib/supabase/server";
import { buildProductPath } from "@/src/lib/navigation/smart-navigation";
import { WishlistButton } from "@/src/components/wishlist/wishlist-button";
import { ProductReviewForm } from "@/src/components/product/product-review-form";

export default async function ProductPage({ params, searchParams }: { params: Promise<{ slug: string }>; searchParams: Promise<{ returnTo?: string }> }) {
  const { slug } = await params;
  const { returnTo } = await searchParams;
  const supabase = await createClient();
  const { data: productRow } = await supabase
    .from("products")
    .select("id, name, slug, description, short_description, price, compare_at_price, stock_quantity, is_active, is_featured, category_id, categories(name), product_images(image_url, position)")
    .eq("slug", slug)
    .eq("is_active", true)
    .maybeSingle();

  if (!productRow) notFound();

  const primaryImage = productRow.product_images?.slice().sort((a, b) => a.position - b.position)[0]?.image_url;
  if (!primaryImage) notFound();

  const product = {
    id: productRow.id,
    slug: productRow.slug,
    name: productRow.name,
    description: productRow.description,
    shortDescription: productRow.short_description ?? productRow.description,
    price: Number(productRow.price),
    compareAtPrice: productRow.compare_at_price === null ? undefined : Number(productRow.compare_at_price),
    category: productRow.categories?.[0]?.name ?? "Uncategorized",
    image: primaryImage,
    weight: productRow.stock_quantity !== null ? `${productRow.stock_quantity} in stock` : "",
    isFeatured: Boolean(productRow.is_featured),
    isNew: false,
    isPopular: false,
  };

  const [{ data: relatedRows }, { data: reviewSummary }, { data: reviews }, { data: { user } }] = await Promise.all([
    supabase
    .from("products")
    .select("id, name, slug, price, compare_at_price, description, short_description, is_featured, stock_quantity, categories(name), product_images(image_url, position)")
    .eq("is_active", true)
    .neq("id", product.id)
    .eq("category_id", productRow.category_id)
    .order("created_at", { ascending: false })
    .limit(4),
    supabase.from("product_review_summaries").select("average_rating, review_count").eq("product_id", product.id).maybeSingle(),
    supabase.from("product_reviews").select("id, rating, review_text, display_name, verified_purchase, created_at").eq("product_id", product.id).eq("status", "published").order("created_at", { ascending: false }).limit(20),
    supabase.auth.getUser(),
  ]);

  const { data: ownReview } = user
    ? await supabase.from("product_reviews").select("rating, review_text").eq("product_id", product.id).eq("user_id", user.id).maybeSingle()
    : { data: null };

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
    category: item.categories?.[0]?.name ?? "Uncategorized",
    image,
    weight: item.stock_quantity !== null ? `${item.stock_quantity} in stock` : "",
    isFeatured: Boolean(item.is_featured),
    isNew: false,
    isPopular: false,
  } : null;
  }).filter((item): item is NonNullable<typeof item> => item !== null);

  const currentProductPath = buildProductPath(product.slug);
  return <main className="mx-auto max-w-7xl px-5 py-10 lg:px-8"><SmartBackButton /><nav aria-label="Breadcrumb" className="mt-2 text-sm text-muted"><Link href="/">Home</Link> <span className="mx-2">/</span> <Link href="/shop">Shop</Link> <span className="mx-2">/</span> <span>{product.name}</span></nav>
    <div className="mt-10 grid gap-10 lg:grid-cols-2 lg:items-start"><div className="relative aspect-square overflow-hidden rounded-3xl bg-[#eadfce]"><Image alt={product.name} className="object-cover" fill loading="eager" priority sizes="(max-width: 1024px) 100vw, 50vw" src={product.image} /></div><div className="lg:py-8"><p className="text-sm text-muted">{product.category}</p><div className="flex items-start justify-between gap-4"><h1 className="mt-3 text-4xl font-semibold text-forest-green">{product.name}</h1><WishlistButton productId={product.id} productName={product.name} /></div><p className="mt-4 text-2xl font-semibold text-forest-green">${product.price.toFixed(2)}</p><p className="mt-2 text-sm text-muted">{product.weight}</p><p className="mt-8 max-w-lg leading-7 text-muted">{product.description}</p><div className="mt-10"><AddToCart product={product} /></div></div></div>
    <section className="mt-16 border-t border-black/10 pt-10"><div className="flex flex-wrap items-baseline justify-between gap-3"><h2 className="text-3xl font-semibold text-forest-green">Customer Reviews</h2><p className="text-sm text-muted">{reviewSummary?.review_count ? <><span className="font-semibold text-gold">★★★★★</span> {Number(reviewSummary.average_rating).toFixed(1)} · {reviewSummary.review_count} {reviewSummary.review_count === 1 ? "review" : "reviews"}</> : "No reviews yet"}</p></div><div className="mt-8 grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(320px,0.75fr)]"><div className="space-y-6">{reviews?.length ? reviews.map((review) => <article className="border-b border-black/10 pb-6" key={review.id}><p className="text-gold" aria-label={`${review.rating} out of 5 stars`}>{"★".repeat(review.rating)}{"☆".repeat(5 - review.rating)}</p>{review.review_text && <p className="mt-3 leading-7 text-foreground">&ldquo;{review.review_text}&rdquo;</p>}<p className="mt-3 text-sm text-muted">{review.display_name}{review.verified_purchase ? " · Verified Purchase" : ""} · {new Date(review.created_at).toLocaleDateString()}</p></article>) : <p className="text-sm text-muted">Be the first to share your experience with this product.</p>}</div><ProductReviewForm isAuthenticated={Boolean(user)} productId={product.id} productSlug={product.slug} review={ownReview} /></div></section>
    <RelatedProducts products={related.length ? related : []} returnTo={returnTo ?? currentProductPath} />
  </main>;
}
