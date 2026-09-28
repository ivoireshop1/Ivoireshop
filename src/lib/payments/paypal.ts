import "server-only";

import { getPaypalConfig, paypalApiBase } from "./config";
import { centsToUsdString, usdToCents } from "./money";

type PaypalCapture = {
  id?: string;
  status?: string;
  amount?: { currency_code?: string; value?: string };
};

async function paypalAccessToken() {
  const config = getPaypalConfig();
  if (!config.configured || !config.environment) throw new Error("PayPal is not configured.");
  const response = await fetch(`${paypalApiBase(config.environment)}/v1/oauth2/token`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${Buffer.from(`${config.clientId}:${config.clientSecret}`).toString("base64")}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: "grant_type=client_credentials",
  });
  const body = (await response.json().catch(() => ({}))) as { access_token?: string };
  if (!response.ok || !body.access_token) throw new Error("PayPal authentication failed.");
  return { token: body.access_token, environment: config.environment, webhookId: config.webhookId };
}

export async function createPaypalOrder(input: {
  amountCents: number;
  ivoireOrderId: string;
  orderNumber: string;
  returnOrigin: string;
}) {
  const { token, environment } = await paypalAccessToken();
  const response = await fetch(`${paypalApiBase(environment)}/v2/checkout/orders`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      intent: "CAPTURE",
      purchase_units: [
        {
          custom_id: input.ivoireOrderId,
          invoice_id: input.orderNumber.slice(0, 127),
          amount: { currency_code: "USD", value: centsToUsdString(input.amountCents) },
        },
      ],
      application_context: {
        brand_name: "Ivoire Shop",
        user_action: "PAY_NOW",
        shipping_preference: "NO_SHIPPING",
        return_url: `${input.returnOrigin}/checkout`,
        cancel_url: `${input.returnOrigin}/checkout`,
      },
    }),
  });
  const body = (await response.json().catch(() => ({}))) as { id?: string; status?: string };
  if (!response.ok || !body.id) {
    return { ok: false as const, error: "PayPal could not start checkout. Please try again." };
  }
  return { ok: true as const, id: body.id, status: body.status ?? "CREATED" };
}

export async function capturePaypalOrder(paypalOrderId: string) {
  const { token, environment } = await paypalAccessToken();
  const response = await fetch(`${paypalApiBase(environment)}/v2/checkout/orders/${encodeURIComponent(paypalOrderId)}/capture`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
  });
  const body = (await response.json().catch(() => ({}))) as {
    id?: string;
    status?: string;
    purchase_units?: {
      custom_id?: string;
      payments?: { captures?: PaypalCapture[] };
    }[];
    details?: { issue?: string }[];
  };
  if (response.status === 422 && body.details?.some((detail) => detail.issue === "ORDER_ALREADY_CAPTURED")) {
    return getPaypalOrder(paypalOrderId);
  }
  if (!response.ok) {
    return { ok: false as const, error: "PayPal checkout could not be completed. Please try again." };
  }
  return parsePaypalOrder(body);
}

export async function getPaypalOrder(paypalOrderId: string) {
  const { token, environment } = await paypalAccessToken();
  const response = await fetch(`${paypalApiBase(environment)}/v2/checkout/orders/${encodeURIComponent(paypalOrderId)}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const body = (await response.json().catch(() => ({}))) as Record<string, unknown>;
  if (!response.ok) return { ok: false as const, error: "PayPal order could not be verified." };
  return parsePaypalOrder(body);
}

function parsePaypalOrder(body: {
  id?: string;
  status?: string;
  purchase_units?: {
    custom_id?: string;
    amount?: { currency_code?: string; value?: string };
    payments?: { captures?: PaypalCapture[] };
  }[];
}) {
  const unit = body.purchase_units?.[0];
  const capture = unit?.payments?.captures?.[0];
  const amountValue = capture?.amount?.value ?? unit?.amount?.value;
  const currency = capture?.amount?.currency_code ?? unit?.amount?.currency_code;
  let amountCents: number | null = null;
  try {
    amountCents = amountValue ? usdToCents(amountValue) : null;
  } catch {
    amountCents = null;
  }
  return {
    ok: true as const,
    id: body.id ?? "",
    status: body.status ?? "",
    customId: unit?.custom_id ?? "",
    captureId: capture?.id ?? "",
    captureStatus: capture?.status ?? "",
    currency: currency ?? "",
    amountCents,
  };
}

export async function verifyPaypalWebhook(headers: Headers, rawBody: string) {
  const config = getPaypalConfig();
  if (!config.webhookId || !config.environment) return false;
  const { token, environment, webhookId } = await paypalAccessToken();
  let event: unknown;
  try {
    event = JSON.parse(rawBody);
  } catch {
    return false;
  }
  const response = await fetch(`${paypalApiBase(environment)}/v1/notifications/verify-webhook-signature`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      auth_algo: headers.get("paypal-auth-algo"),
      cert_url: headers.get("paypal-cert-url"),
      transmission_id: headers.get("paypal-transmission-id"),
      transmission_sig: headers.get("paypal-transmission-sig"),
      transmission_time: headers.get("paypal-transmission-time"),
      webhook_id: webhookId,
      webhook_event: event,
    }),
  });
  const body = (await response.json().catch(() => ({}))) as { verification_status?: string };
  return response.ok && body.verification_status === "SUCCESS";
}
