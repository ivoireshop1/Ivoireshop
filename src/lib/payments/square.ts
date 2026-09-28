import "server-only";

import { getSquareConfig, squareApiBase } from "./config";
import { centsToUsdString } from "./money";

type SquarePayment = {
  id?: string;
  status?: string;
  amount_money?: { amount?: number; currency?: string };
  order_id?: string;
  location_id?: string;
  reference_id?: string;
};

export async function createSquarePayment(input: {
  sourceId: string;
  amountCents: number;
  idempotencyKey: string;
  referenceId: string;
}) {
  const config = getSquareConfig();
  if (!config.configured || !config.environment) {
    return { ok: false as const, error: "Square is not configured." };
  }
  const response = await fetch(`${squareApiBase(config.environment)}/v2/payments`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${config.accessToken}`,
      "Content-Type": "application/json",
      "Square-Version": "2025-09-24",
    },
    body: JSON.stringify({
      source_id: input.sourceId,
      idempotency_key: input.idempotencyKey,
      autocomplete: true,
      location_id: config.locationId,
      reference_id: input.referenceId.slice(0, 40),
      amount_money: {
        amount: input.amountCents,
        currency: "USD",
      },
    }),
  });
  const body = (await response.json().catch(() => ({}))) as {
    payment?: SquarePayment;
    errors?: { detail?: string; code?: string }[];
  };
  if (!response.ok || !body.payment) {
    const declined = body.errors?.some((error) => /CARD|DECLINE|INVALID/i.test(`${error.code ?? ""} ${error.detail ?? ""}`));
    return {
      ok: false as const,
      error: declined
        ? "Payment couldn't be completed. Please try again."
        : "Square could not process this payment. Please try again.",
      declined: Boolean(declined),
    };
  }
  return { ok: true as const, payment: body.payment };
}

export function squarePaymentMatches(payment: SquarePayment, amountCents: number) {
  return (
    payment.status === "COMPLETED" &&
    payment.amount_money?.currency === "USD" &&
    payment.amount_money?.amount === amountCents &&
    Number.isSafeInteger(payment.amount_money.amount)
  );
}

export function squarePaymentPending(payment: SquarePayment) {
  return payment.status === "APPROVED" || payment.status === "PENDING";
}

export { centsToUsdString };
