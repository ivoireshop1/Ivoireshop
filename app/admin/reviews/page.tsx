import Link from "next/link";
import { ConfirmSubmitButton } from "@/src/components/admin/confirm-submit-button";
import { requireAdmin } from "@/src/lib/auth/guards";
import { deleteProductReviewAsAdmin, setProductReviewStatus } from "@/src/lib/admin/reviews";
import { toOneRelation } from "@/src/lib/catalog/relation-utils";

export default async function AdminReviewsPage({
  searchParams,
}: {
  searchParams: Promise<{ rating?: string; q?: string; status?: string; error?: string; success?: string }>;
}) {
  const { supabase } = await requireAdmin();
  const { rating, q, status, error, success } = await searchParams;
  const validRating = ["1", "2", "3", "4", "5"].includes(rating ?? "") ? Number(rating) : null;
  const validStatus = ["pending", "published", "hidden"].includes(status ?? "") ? status : "all";
  let query = supabase
    .from("product_reviews")
    .select("id, user_id, rating, review_text, review_title, display_name, verified_purchase, status, created_at, product:product_id(id, name, slug)")
    .order("created_at", { ascending: false });
  if (validRating) query = query.eq("rating", validRating);
  if (validStatus !== "all") query = query.eq("status", validStatus);
  if (q?.trim()) query = query.or(`review_text.ilike.%${q.trim()}%,review_title.ilike.%${q.trim()}%`);
  const { data: reviews } = await query;

  return (
    <div className="space-y-6">
      <div>
        <p className="text-[11px] font-medium uppercase tracking-[0.22em] text-[#b8964c]">Customer feedback</p>
        <h1 className="mt-2 text-3xl font-semibold text-[#173f35]">Product reviews</h1>
      </div>
      {error ? <p className="rounded-2xl border border-[#7f1d1d]/20 bg-[#7f1d1d]/5 px-4 py-3 text-sm text-[#7f1d1d]">The review action could not be completed.</p> : null}
      {success ? <p className="rounded-2xl border border-[#173f35]/15 bg-[#173f35]/5 px-4 py-3 text-sm text-[#173f35]">Review updated.</p> : null}
      <div className="flex flex-wrap gap-3 text-sm">
        <Link className="underline underline-offset-4" href="/admin/reviews?status=pending">Pending</Link>
        <Link className="underline underline-offset-4" href="/admin/reviews?status=published">Published</Link>
        <Link className="underline underline-offset-4" href="/admin/reviews?status=hidden">Hidden</Link>
        <Link className="underline underline-offset-4" href="/admin/reviews">All</Link>
      </div>
      <form className="flex flex-wrap gap-3" method="get">
        <input name="status" type="hidden" value={validStatus === "all" ? "" : validStatus} />
        <input aria-label="Search review text" className="min-h-11 rounded-xl border border-[#173f35]/15 bg-white px-3 py-2 text-sm" defaultValue={q} name="q" placeholder="Search review text" />
        <select aria-label="Filter by rating" className="min-h-11 rounded-xl border border-[#173f35]/15 bg-white px-3 py-2 text-sm" defaultValue={rating ?? ""} name="rating">
          <option value="">All ratings</option>
          {[5, 4, 3, 2, 1].map((value) => (
            <option key={value} value={value}>{value} stars</option>
          ))}
        </select>
        <button className="min-h-11 rounded-xl bg-[#173f35] px-4 py-2 text-sm font-semibold text-white" type="submit">Filter</button>
      </form>
      <div className="space-y-3">
        {reviews?.length ? reviews.map((review) => {
          const product = toOneRelation(review.product);
          return (
            <article className="rounded-2xl border border-[#173f35]/10 bg-white p-5" key={review.id}>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-gold" aria-label={`${review.rating} out of 5 stars`}>{"★".repeat(review.rating)}{"☆".repeat(5 - review.rating)}</p>
                  {review.review_title ? <h2 className="mt-2 font-semibold text-[#173f35]">{review.review_title}</h2> : null}
                  <p className="mt-2 font-semibold text-[#173f35]">{review.display_name}</p>
                  <p className="mt-1 text-sm text-[#6b6b6b]">{review.created_at.slice(0, 10)}</p>
                </div>
                <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${review.status === "published" ? "bg-[#173f35]/10 text-[#173f35]" : review.status === "pending" ? "bg-[#b8964c]/15 text-[#7c5d1a]" : "bg-[#7f1d1d]/10 text-[#7f1d1d]"}`}>{review.status}</span>
              </div>
              <p className="mt-4 text-sm leading-6 text-[#4f4f4f]">{review.review_text || "No written review."}</p>
              <p className="mt-3 text-sm font-medium text-[#173f35]">
                Product: <Link className="underline underline-offset-4" href={`/product/${product?.slug}`}>{product?.name ?? "Deleted product"}</Link>
                {review.verified_purchase ? " · Verified purchase" : ""}
              </p>
              <div className="mt-4 flex flex-wrap gap-3">
                {review.status !== "published" ? (
                  <form action={setProductReviewStatus}>
                    <input name="id" type="hidden" value={review.id} />
                    <input name="status" type="hidden" value="published" />
                    <button className="min-h-11 text-sm font-semibold text-[#173f35] underline underline-offset-4" type="submit">Approve / Publish</button>
                  </form>
                ) : null}
                {review.status !== "hidden" ? (
                  <form action={setProductReviewStatus}>
                    <input name="id" type="hidden" value={review.id} />
                    <input name="status" type="hidden" value="hidden" />
                    <button className="min-h-11 text-sm font-semibold text-[#7c5d1a] underline underline-offset-4" type="submit">Hide / Reject</button>
                  </form>
                ) : null}
                <form action={deleteProductReviewAsAdmin}>
                  <input name="id" type="hidden" value={review.id} />
                  <ConfirmSubmitButton
                    className="min-h-11 text-sm font-semibold text-[#7f1d1d] underline underline-offset-4"
                    label="Delete"
                    message="Delete this review permanently?"
                  />
                </form>
              </div>
            </article>
          );
        }) : <p className="rounded-2xl border border-dashed border-[#173f35]/20 bg-white p-6 text-sm text-[#6b6b6b]">No reviews match these filters.</p>}
      </div>
    </div>
  );
}
