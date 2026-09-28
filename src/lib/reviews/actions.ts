"use server";

import { revalidatePath } from "next/cache";
import { unstable_rethrow } from "next/navigation";
import { createClient } from "@/src/lib/supabase/server";
import { reviewActionMessage } from "@/src/lib/reviews/errors";

export type ReviewActionState = { error: string | null; success: boolean };

export const initialReviewActionState: ReviewActionState = { error: null, success: false };

function textValue(formData: FormData, name: string) {
  return String(formData.get(name) ?? "").trim();
}

function reviewPath(slug: string) {
  return `/product/${slug}`;
}

export async function saveProductReview(_: ReviewActionState, formData: FormData): Promise<ReviewActionState> {
  try {
    const productId = textValue(formData, "product_id");
    const productSlug = textValue(formData, "product_slug");
    const rating = Number(textValue(formData, "rating"));
    const reviewText = textValue(formData, "review_text");

    if (!productId || !productSlug || !Number.isInteger(rating) || rating < 1 || rating > 5) {
      return { error: "Choose a rating from 1 to 5.", success: false };
    }

    if (reviewText.length > 1000) {
      return { error: "Review text must be 1,000 characters or fewer.", success: false };
    }
    const reviewTitle = textValue(formData, "review_title");
    if (reviewTitle.length > 120) {
      return { error: "Review title must be 120 characters or fewer.", success: false };
    }

    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { error: "Sign in to submit a review.", success: false };

    const { error } = await supabase.rpc("submit_product_review", {
      p_product_id: productId,
      p_rating: rating,
      p_review_text: reviewText || null,
      p_review_title: reviewTitle || null,
    });
    if (error) return { error: reviewActionMessage(error), success: false };

    revalidatePath(reviewPath(productSlug));
    return { error: null, success: true };
  } catch (error) {
    unstable_rethrow(error);
    return { error: reviewActionMessage({ message: error instanceof Error ? error.message : null }), success: false };
  }
}

export async function deleteProductReview(_: ReviewActionState, formData: FormData): Promise<ReviewActionState> {
  try {
    const productId = textValue(formData, "product_id");
    const productSlug = textValue(formData, "product_slug");
    if (!productId || !productSlug) return { error: "Review not found.", success: false };

    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { error: "Sign in to manage your review.", success: false };

    const { error } = await supabase
      .from("product_reviews")
      .delete()
      .eq("product_id", productId)
      .eq("user_id", user.id);
    if (error) return { error: reviewActionMessage(error), success: false };

    revalidatePath(reviewPath(productSlug));
    return { error: null, success: true };
  } catch (error) {
    unstable_rethrow(error);
    return { error: reviewActionMessage({ message: error instanceof Error ? error.message : null }), success: false };
  }
}
