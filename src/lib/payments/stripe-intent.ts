export type StripeIntentAction = "already_paid" | "resume" | "wait" | "new";

export function nextStripeIntentAction(input: {
  orderPaid: boolean;
  intentStatus?: string | null;
}): StripeIntentAction {
  if (input.orderPaid || input.intentStatus === "succeeded") return "already_paid";
  if (input.intentStatus === "processing" || input.intentStatus === "requires_capture") return "wait";
  if (
    input.intentStatus === "requires_payment_method"
    || input.intentStatus === "requires_confirmation"
    || input.intentStatus === "requires_action"
  ) {
    return "resume";
  }
  return "new";
}

export function stripeIntentIdempotencyKey(orderId: string, previousIntentId?: string | null) {
  if (previousIntentId && previousIntentId.startsWith("pi_")) {
    return `ivoire-pi-${orderId}-after-${previousIntentId.slice(-12)}`;
  }
  return `ivoire-pi-${orderId}`;
}
