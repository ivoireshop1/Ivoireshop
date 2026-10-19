export const CUSTOMER_CARD_UNAVAILABLE =
  "Card payment is not available right now. Please contact the store if you need help completing your order.";

export function customerPaymentMessage(input: {
  stripeReady: boolean;
  testMode: boolean;
  liveBlocked: boolean;
}) {
  if (input.liveBlocked || !input.stripeReady) return CUSTOMER_CARD_UNAVAILABLE;
  if (input.testMode) return "TEST MODE. Pay with a test card. This is not a live charge.";
  return "Pay securely with your card. The charged amount is the store-confirmed order total.";
}

export type PublicPaymentConfig = {
  stripeReady: boolean;
  stripeTestMode: boolean;
  paymentUnavailableMessage: string;
};

export function toPublicPaymentConfig(input: {
  ready: boolean;
  mode: "test" | "live" | null;
  liveBlocked: boolean;
}): PublicPaymentConfig {
  const stripeReady = input.ready === true;
  return {
    stripeReady,
    stripeTestMode: stripeReady && input.mode === "test",
    paymentUnavailableMessage: customerPaymentMessage({
      stripeReady,
      testMode: input.mode === "test",
      liveBlocked: input.liveBlocked,
    }),
  };
}
