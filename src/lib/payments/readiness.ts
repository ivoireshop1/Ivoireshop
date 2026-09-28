// No provider adapter is installed. Environment key presence alone does not
// establish working payments, verified webhooks, or a supported currency.
export function getPaymentReadiness() {
  return { enabled: false as const, mode: "separate_collection" as const,
    message: "Online payment is not available. Payment is collected separately." };
}

// Future server-only adapters must load the order and amount from the database,
// authenticate its owner (or an explicit guest capability), verify signed
// provider events, and persist unique event IDs before changing payment_status.
// Never accept a browser amount or treat a redirect as proof of payment.
