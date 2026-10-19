export const CUSTOMER_CARD_UNAVAILABLE =
  "Card payment is not available right now. Please contact the store if you need help completing your order.";

export function customerPaymentMessage(input: {
  stripeReady: boolean;
  testMode: boolean;
  liveBlocked: boolean;
  taxBlocked?: boolean;
  taxBlockedMessage?: string;
}) {
  if (input.taxBlocked) {
    return input.taxBlockedMessage
      || "Online payment is unavailable until sales tax is configured and verified for your area. You can still browse, use your cart, and contact the store for help.";
  }
  if (input.liveBlocked || !input.stripeReady) return CUSTOMER_CARD_UNAVAILABLE;
  if (input.testMode) return "TEST MODE. Pay with a test card. This is not a live charge.";
  return "Pay securely with your card. The charged amount is the store-confirmed order total.";
}

export type PublicPaymentConfig = {
  stripeReady: boolean;
  stripeTestMode: boolean;
  paymentUnavailableMessage: string;
  taxBlocked?: boolean;
};

export function toPublicPaymentConfig(input: {
  ready: boolean;
  mode: "test" | "live" | null;
  liveBlocked: boolean;
  taxBlocked?: boolean;
  taxBlockedMessage?: string;
}): PublicPaymentConfig {
  const taxBlocked = input.taxBlocked === true;
  const stripeReady = input.ready === true && !taxBlocked;
  return {
    stripeReady,
    stripeTestMode: stripeReady && input.mode === "test",
    taxBlocked,
    paymentUnavailableMessage: customerPaymentMessage({
      stripeReady: input.ready === true,
      testMode: input.mode === "test",
      liveBlocked: input.liveBlocked,
      taxBlocked,
      taxBlockedMessage: input.taxBlockedMessage,
    }),
  };
}
