export function reviewActionMessage(error: { message?: string | null; code?: string | null } | null | undefined) {
  const code = String(error?.code ?? "");
  const message = String(error?.message ?? "");
  if (code === "42501" || /sign in/i.test(message)) return "Sign in to submit a review.";
  if (code === "22023" || /rating must be between/i.test(message)) return "Choose a rating from 1 to 5.";
  if (/1,000 characters/i.test(message) || /1000 characters/i.test(message)) {
    return "Review text must be 1,000 characters or fewer.";
  }
  if (/120 characters/i.test(message)) return "Review title must be 120 characters or fewer.";
  if (code === "P0002" || /product not found/i.test(message)) return "This product is no longer available to review.";
  if (/could not find the function/i.test(message) || code === "PGRST202" || code === "PGRST203") {
    return "Reviews are temporarily unavailable. Please try again shortly.";
  }
  if (code === "42P17") return "Reviews are temporarily unavailable. Please try again shortly.";
  if (message && !/permission denied|jwt|token|api key|secret/i.test(message) && message.length < 180) {
    return message;
  }
  return "Your review could not be saved. Please try again.";
}
