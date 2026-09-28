export const REVIEW_SUBMITTED_MESSAGE = "Thank you. Your review was submitted for approval.";

export function isPublicReviewStatus(status: string | null | undefined) {
  return status === "published";
}

export function starDisplay(rating: number | null | undefined) {
  const filled = Math.max(0, Math.min(5, Math.round(Number(rating) || 0)));
  return { filled, empty: 5 - filled };
}
