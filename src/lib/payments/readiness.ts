import {
  getPaypalConfig,
  getSquareConfig,
  hasPaymentAdminClient,
} from "./config";

export function getPaymentReadiness() {
  const square = getSquareConfig();
  const paypal = getPaypalConfig();
  const canRecord = hasPaymentAdminClient();
  const squareReady = square.configured && canRecord;
  const paypalReady = paypal.configured && canRecord;
  const enabled = squareReady || paypalReady;
  return {
    enabled,
    mode: enabled ? ("online" as const) : ("separate_collection" as const),
    canRecord,
    square: {
      configured: square.configured,
      ready: squareReady,
      label: square.configured ? "Ready" : "Not configured",
      public: square.configured ? square.public : null,
    },
    paypal: {
      configured: paypal.configured,
      ready: paypalReady,
      label: paypal.configured ? "Ready" : "Not configured",
      public: paypal.configured ? paypal.public : null,
    },
    message: enabled
      ? "Pay securely with Square or PayPal. The charged amount is always the store-confirmed order total."
      : "Online payment is not available. Configure Square and/or PayPal sandbox credentials on the server before checkout can collect payment.",
  };
}

export type PublicPaymentConfig = ReturnType<typeof getPaymentReadiness>;
