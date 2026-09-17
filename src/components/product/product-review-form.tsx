"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { deleteProductReview, initialReviewActionState, saveProductReview } from "@/src/lib/reviews/actions";

type Review = { rating: number; review_text: string | null } | null;

export function ProductReviewForm({ productId, productSlug, isAuthenticated, review }: { productId: string; productSlug: string; isAuthenticated: boolean; review: Review }) {
  const [rating, setRating] = useState(review?.rating ?? 0);
  const [saveState, saveAction, isSaving] = useActionState(saveProductReview, initialReviewActionState);
  const [deleteState, deleteAction, isDeleting] = useActionState(deleteProductReview, initialReviewActionState);

  if (!isAuthenticated) {
    return <p className="mt-6 text-sm text-muted"><Link className="font-semibold text-forest-green underline underline-offset-4" href={`/login?returnTo=${encodeURIComponent(`/product/${productSlug}`)}`}>Sign in</Link> to leave a review.</p>;
  }

  return <section className="mt-8 border-t border-black/10 pt-8">
    <h2 className="text-xl font-semibold text-forest-green">{review ? "Update your review" : "Write a review"}</h2>
    <form action={saveAction} className="mt-4 space-y-4">
      <input name="product_id" type="hidden" value={productId} />
      <input name="product_slug" type="hidden" value={productSlug} />
      <input name="rating" type="hidden" value={rating} />
      <fieldset>
        <legend className="text-sm font-medium">Your rating</legend>
        <div className="mt-2 flex gap-1" role="radiogroup">
          {[1, 2, 3, 4, 5].map((value) => <button aria-label={`${value} star${value === 1 ? "" : "s"}`} aria-pressed={rating === value} className={`min-h-11 min-w-11 text-2xl ${value <= rating ? "text-gold" : "text-black/20"}`} key={value} onClick={() => setRating(value)} type="button">★</button>)}
        </div>
      </fieldset>
      <label className="block text-sm font-medium">Review <span className="font-normal text-muted">(optional)</span><textarea className="mt-2 min-h-28 w-full rounded-lg border border-black/15 px-3 py-2" defaultValue={review?.review_text ?? ""} maxLength={1000} name="review_text" /></label>
      <button className="rounded-lg bg-forest-green px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-60" disabled={rating === 0 || isSaving} type="submit">{isSaving ? "Saving..." : review ? "Update review" : "Submit review"}</button>
      {(saveState.error || saveState.success) && <p className="text-sm text-muted" role="status">{saveState.error ?? "Your review has been saved."}</p>}
    </form>
    {review && <form action={deleteAction} className="mt-3"><input name="product_id" type="hidden" value={productId} /><input name="product_slug" type="hidden" value={productSlug} /><button className="text-sm font-semibold text-muted underline underline-offset-4 disabled:opacity-60" disabled={isDeleting} type="submit">{isDeleting ? "Removing..." : "Delete your review"}</button>{(deleteState.error || deleteState.success) && <p className="mt-2 text-sm text-muted" role="status">{deleteState.error ?? "Your review has been removed."}</p>}</form>}
  </section>;
}