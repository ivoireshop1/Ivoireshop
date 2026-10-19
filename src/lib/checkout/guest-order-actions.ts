"use server";

import { createClient } from "@/src/lib/supabase/server";
import { createAdminClient } from "@/src/lib/supabase/admin";
import { getEmailProviderStatus, sendTransactionalEmail } from "@/src/lib/email/send";
import { resolvePublicSiteUrl } from "@/src/lib/site";
import { isGuestAccessToken } from "@/src/lib/checkout/guest-order-storage";
import type { GuestOrderListItem } from "@/src/lib/checkout/guest-order-lifecycle";
import { headers } from "next/headers";

const MAX_TOKENS_PER_REQUEST = 24;
const RECOVERY_LOOKBACK_DAYS = 180;
const RECOVERY_MAX_ORDERS = 10;

function mapConfirmationRow(token: string, row: Record<string, unknown>): GuestOrderListItem | null {
  const orderId = row.order_id ? String(row.order_id) : "";
  if (!orderId) return null;
  const itemsRaw = Array.isArray(row.items) ? row.items : [];
  return {
    token,
    orderId,
    orderNumber: String(row.order_number ?? ""),
    confirmationCode: String(row.confirmation_code ?? ""),
    status: String(row.status ?? ""),
    paymentStatus: String(row.payment_status ?? ""),
    paymentProvider: row.payment_provider ? String(row.payment_provider) : null,
    paymentMethod: row.payment_method ? String(row.payment_method) : null,
    fulfillmentMethod: String(row.fulfillment_method ?? ""),
    fulfillmentProvider: row.fulfillment_provider ? String(row.fulfillment_provider) : null,
    fulfillmentService: row.fulfillment_service ? String(row.fulfillment_service) : null,
    trackingNumber: row.tracking_number ? String(row.tracking_number) : null,
    shippedAt: row.shipped_at ? String(row.shipped_at) : null,
    total: Number(row.total ?? 0),
    subtotal: Number(row.subtotal ?? row.total ?? 0),
    shippingCost: Number(row.shipping_cost ?? 0),
    taxAmount: Number(row.tax_amount ?? 0),
    createdAt: String(row.created_at ?? ""),
    items: itemsRaw.map((item) => {
      const rowItem = item as Record<string, unknown>;
      return {
        product_name: String(rowItem.product_name ?? "Item"),
        product_price: Number(rowItem.product_price ?? 0),
        quantity: Number(rowItem.quantity ?? 1),
        image_url: rowItem.image_url ? String(rowItem.image_url) : null,
      };
    }),
  };
}

/** Load guest orders by high-entropy tokens only. Invalid tokens are omitted (never guessed by order number). */
export async function loadGuestOrdersByTokens(tokens: string[]): Promise<{
  orders: GuestOrderListItem[];
  invalidCount: number;
}> {
  const unique = [...new Set(tokens.filter(isGuestAccessToken))].slice(0, MAX_TOKENS_PER_REQUEST);
  const invalidCount = Math.max(0, tokens.length - unique.length);
  if (!unique.length) return { orders: [], invalidCount };

  const supabase = await createClient();
  const orders: GuestOrderListItem[] = [];

  // Sequential RPC keeps each lookup scoped to one token (security definer; no bulk dump).
  for (const token of unique) {
    try {
      const { data, error } = await supabase.rpc("get_checkout_confirmation", { p_access_token: token });
      if (error) continue;
      const row = Array.isArray(data) ? data[0] : data;
      if (!row || typeof row !== "object") continue;
      const mapped = mapConfirmationRow(token, row as Record<string, unknown>);
      if (mapped) orders.push(mapped);
    } catch {
      /* skip unverifiable token — do not leak */
    }
  }

  orders.sort((left, right) => Date.parse(right.createdAt) - Date.parse(left.createdAt));
  return { orders, invalidCount };
}

const RECOVERY_GENERIC =
  "If we find guest orders for that email, we will send a secure recovery link. Check your inbox shortly.";

function normalizeEmail(value: string) {
  return value.trim().toLowerCase();
}

async function recoverySiteOrigin() {
  const headerStore = await headers();
  const host = headerStore.get("x-forwarded-host") || headerStore.get("host") || "";
  const proto = headerStore.get("x-forwarded-proto") || "https";
  const browserOrigin = host ? `${proto}://${host}` : undefined;
  return resolvePublicSiteUrl(process.env as NodeJS.ProcessEnv, browserOrigin);
}

/**
 * Email recovery for a different device. Never returns order details to the client.
 * Always responds with the same generic message whether or not orders exist.
 */
export async function requestGuestOrderEmailRecovery(emailInput: string): Promise<{
  ok: true;
  message: string;
  emailConfigured: boolean;
}> {
  const email = normalizeEmail(emailInput);
  const emailConfigured = getEmailProviderStatus().configured;

  if (
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
    || email.length > 254
    || /[%_]/.test(email)
  ) {
    return { ok: true, message: RECOVERY_GENERIC, emailConfigured };
  }

  if (!emailConfigured) {
    return {
      ok: true,
      message:
        "Email recovery is not available yet. On the device where you placed the order, open Track My Order — or keep your confirmation page link. We never look up orders by email or order number alone.",
      emailConfigured: false,
    };
  }

  const admin = createAdminClient();
  if (!admin) {
    return { ok: true, message: RECOVERY_GENERIC, emailConfigured };
  }

  try {
    const since = new Date(Date.now() - RECOVERY_LOOKBACK_DAYS * 24 * 60 * 60 * 1000).toISOString();
    const { data } = await admin
      .from("orders")
      .select("guest_access_token, confirmation_code, created_at")
      .is("user_id", null)
      .ilike("customer_email", email)
      .gte("created_at", since)
      .not("guest_access_token", "is", null)
      .order("created_at", { ascending: false })
      .limit(RECOVERY_MAX_ORDERS);

    const rows = (data ?? []).filter((row) => isGuestAccessToken(row.guest_access_token));
    if (rows.length) {
      const origin = await recoverySiteOrigin();
      const links = rows
        .map((row) => {
          const token = String(row.guest_access_token);
          const code = row.confirmation_code ? String(row.confirmation_code) : "Order";
          return `• ${code}: ${origin}/order/confirm/${token}`;
        })
        .join("\n");
      const htmlLinks = rows
        .map((row) => {
          const token = String(row.guest_access_token);
          const code = row.confirmation_code ? String(row.confirmation_code) : "Order";
          const href = `${origin}/order/confirm/${token}`;
          return `<li><strong>${code}</strong> — <a href="${href}">Open order</a></li>`;
        })
        .join("");

      await sendTransactionalEmail({
        to: email,
        subject: "Your Ivoire Shop order recovery links",
        text: [
          "Use these secure links to open your guest orders on this device.",
          "Do not share these links. Anyone with a link can view that order.",
          "",
          links,
          "",
          "If you did not request this, you can ignore this email.",
        ].join("\n"),
        html: `<p>Use these secure links to open your guest orders on this device.</p><p>Do not share these links.</p><ul>${htmlLinks}</ul><p>If you did not request this, you can ignore this email.</p>`,
      });
    }
  } catch {
    console.error("[guest-order-recovery] request failed");
  }

  return { ok: true, message: RECOVERY_GENERIC, emailConfigured };
}
