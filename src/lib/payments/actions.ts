"use server";

import type { CheckoutReceipt } from "@/src/lib/checkout/checkout-validation";

export type PaymentActionResult =
  | { success: true; receipt: CheckoutReceipt; emailSent: boolean }
  | { success: false; error: string; pending?: boolean; cancelled?: boolean; receipt?: CheckoutReceipt };

const retired = "Online checkout uses Stripe only.";

export async function payWithSquare(): Promise<PaymentActionResult> {
  return { success: false, error: retired };
}

export async function startPaypalPayment(): Promise<
  { success: true; paypalOrderId: string } | PaymentActionResult
> {
  return { success: false, error: retired };
}

export async function capturePaypalPayment(): Promise<PaymentActionResult> {
  return { success: false, error: retired };
}

export async function markPaypalCancelled(): Promise<PaymentActionResult> {
  return { success: false, cancelled: true, error: retired };
}
