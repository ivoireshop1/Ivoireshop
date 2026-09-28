import Link from "next/link";
import { ProductImage } from "@/src/components/product/product-image";
import { AddToCart } from "@/src/components/product/add-to-cart";
import { RelatedProducts } from "@/src/components/product/related-products";
import { WishlistButton } from "@/src/components/wishlist/wishlist-button";
import { ProductReviewForm } from "@/src/components/product/product-review-form";
import { ProductBadge } from "@/src/components/product/product-badge";
import { starDisplay } from "@/src/lib/reviews/public";
import type { Product } from "@/src/types/catalog";

type ReviewRow = {
  id: string;
  rating: number;
  review_text: string | null;
  review_title: string | null;
  display_name: string | null;
  verified_purchase: boolean | null;
  created_at: string;
};

export function ProductStorefrontDetail({
  product,
  related,
  reviewSummary,
  reviews,
  ownReview,
  isAuthenticated,
  returnTo,
  mode = "storefront",
  editHref,
}: {
  product: Product;
  related: Product[];
  reviewSummary: { average_rating: number | null; review_count: number | null } | null;
  reviews: ReviewRow[];
  ownReview: { rating: number; review_text: string | null; review_title: string | null; status: string } | null;
  isAuthenticated: boolean;
  returnTo: string;
  mode?: "storefront" | "preview";
  editHref?: string;
}) {
  const preview = mode === "preview";
  const badge = product.isComingSoon ? "Coming Soon" : product.isNew ? "New" : product.isFeatured ? "Featured" : null;
  const priceLabel = !Number.isFinite(product.price) || product.price <= 0 ? null : `$${product.price.toFixed(2)}`;

  return (
    <main className="mx-auto max-w-7xl px-5 py-10 lg:px-8">
      {preview ? (
        <div className="rounded-2xl border border-[#173f35]/15 bg-[#f5f0e6] px-4 py-3 text-sm text-[#173f35]">
          <p className="font-semibold">Admin preview — this product is not published.</p>
          <p className="mt-1">Guests and customers cannot see this page, and it cannot be added to the cart.</p>
          {editHref ? (
            <Link className="mt-3 inline-flex min-h-11 items-center font-semibold underline underline-offset-4" href={editHref}>
              Back to Edit Product
            </Link>
          ) : null}
        </div>
      ) : null}
      <nav aria-label="Breadcrumb" className="mt-4 text-sm text-muted">
        <Link href="/">Home</Link> <span className="mx-2">/</span> <Link href="/shop">Shop</Link> <span className="mx-2">/</span> <span>{product.name}</span>
      </nav>
      <div className="mt-10 grid gap-10 lg:grid-cols-2 lg:items-start">
        <div className="relative aspect-square overflow-hidden rounded-3xl bg-[#eadfce]">
          <ProductImage alt={product.name} className="object-cover" fill loading="eager" priority sizes="(max-width: 1024px) 100vw, 50vw" src={product.image} />
          {badge ? <ProductBadge label={badge} /> : null}
        </div>
        <div className="lg:py-8">
          <p className="text-sm text-muted">{product.category}</p>
          <div className="flex items-start justify-between gap-4">
            <h1 className="mt-3 text-4xl font-semibold text-forest-green">{product.name}</h1>
            {preview ? null : <WishlistButton productId={product.id} productName={product.name} />}
          </div>
          {product.isComingSoon ? (
            <p className="mt-4 text-2xl font-semibold text-forest-green">Coming soon</p>
          ) : (
            <p className="mt-4 text-2xl font-semibold text-forest-green">{priceLabel ?? "Price pending"}</p>
          )}
          {product.isComingSoon ? (
            <p className="mt-2 text-sm text-muted">This product is not available to order yet.</p>
          ) : (
            <p className="mt-2 text-sm text-muted">{product.weight}</p>
          )}
          <p className="mt-8 max-w-lg leading-7 text-muted">{product.shortDescription || product.description}</p>
          {product.description && product.shortDescription && product.description !== product.shortDescription ? (
            <p className="mt-6 max-w-lg leading-7 text-muted">{product.description}</p>
          ) : null}
          <div className="mt-10">
            {preview ? (
              <p className="rounded-xl border border-forest-green/15 bg-[#f5f0e6] px-4 py-3 text-sm text-muted">
                Unpublished drafts cannot be added to the cart or checked out.
              </p>
            ) : product.isComingSoon ? (
              <p className="rounded-xl border border-forest-green/15 bg-[#f5f0e6] px-4 py-3 text-sm text-muted">
                Ordering will open when this product becomes Active.
              </p>
            ) : (
              <AddToCart product={product} />
            )}
          </div>
        </div>
      </div>
      {preview ? null : (
        <>
          <section className="mt-16 border-t border-black/10 pt-10">
            <div className="flex flex-wrap items-baseline justify-between gap-3">
              <h2 className="text-3xl font-semibold text-forest-green">Customer Reviews</h2>
              <p className="text-sm text-muted">
                {reviewSummary?.review_count ? (
                  <>
                    <span className="font-semibold text-gold" aria-hidden="true">
                      {(() => {
                        const stars = starDisplay(Number(reviewSummary.average_rating));
                        return `${"★".repeat(stars.filled)}${"☆".repeat(stars.empty)}`;
                      })()}
                    </span>{" "}
                    {Number(reviewSummary.average_rating).toFixed(1)} · {reviewSummary.review_count}{" "}
                    {reviewSummary.review_count === 1 ? "review" : "reviews"}
                  </>
                ) : (
                  "No reviews yet"
                )}
              </p>
            </div>
            <div className="mt-8 grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(320px,0.75fr)]">
              <div className="space-y-6">
                {reviews.length ? (
                  reviews.map((review) => {
                    const stars = starDisplay(review.rating);
                    return (
                      <article className="border-b border-black/10 pb-6" key={review.id}>
                        <p className="text-gold" aria-label={`${stars.filled} out of 5 stars`}>
                          {"★".repeat(stars.filled)}
                          {"☆".repeat(stars.empty)}
                        </p>
                        {review.review_title ? <h3 className="mt-2 font-semibold text-forest-green">{review.review_title}</h3> : null}
                        {review.review_text ? <p className="mt-3 leading-7 text-foreground">&ldquo;{review.review_text}&rdquo;</p> : null}
                        <p className="mt-3 text-sm text-muted">
                          {review.display_name}
                          {review.verified_purchase ? " · Verified Purchase" : ""} · {new Date(review.created_at).toLocaleDateString()}
                        </p>
                      </article>
                    );
                  })
                ) : (
                  <p className="text-sm text-muted">Be the first to share your experience with this product.</p>
                )}
              </div>
              <ProductReviewForm isAuthenticated={isAuthenticated} productId={product.id} productSlug={product.slug} review={ownReview} />
            </div>
          </section>
          <RelatedProducts products={related} returnTo={returnTo} />
        </>
      )}
    </main>
  );
}
