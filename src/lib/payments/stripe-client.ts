import type { StripeConstructorOptions } from "@stripe/stripe-js";

/** Hide Stripe's sandbox testing assistant. Payment Element behavior is unchanged. */
export function stripeBrowserOptions(): StripeConstructorOptions {
  return {
    developerTools: {
      assistant: {
        enabled: false,
      },
    },
  };
}
