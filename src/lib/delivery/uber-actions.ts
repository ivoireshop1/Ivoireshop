"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin, requireUser } from "@/src/lib/auth/guards";
import { STORE_SETTINGS_ID } from "@/src/lib/store/constants";
import { createAdminClient } from "@/src/lib/supabase/admin";
import { getGuestOrderConfirmation } from "@/src/lib/checkout/guest-order";
import { parseAdminMiles } from "./manual";
import { formatOriginLines, originFromSettings, originIsComplete } from "./origin";
import {
  explainUberCheckoutBlocker,
  uberDirectCredentials,
  uberDirectEnvironment,
} from "./credentials";
import { formatUberAddress, getUberAccessToken, quoteUberDelivery } from "./providers/uber-direct";
import { cancelUberDeliveryForOrder, refreshUberDeliveryRecord, retryUberDeliveryForOrder } from "./uber-dispatch";
import { recordUberQuoteEvent } from "./uber-events";
import { uberCustomerStage, type UberCustomerStage } from "./uber-status";

function revalidateUberAdmin() {
  revalidatePath("/admin/delivery");
  revalidatePath("/admin/delivery/uber");
}

export async function saveUberDirectSettings(_prev: { error?: string; saved?: boolean } | null, formData: FormData) {
  const { supabase } = await requireAdmin();
  const markup = Number(String(formData.get("uber_direct_markup_cents") ?? "0").trim());
  if (!Number.isInteger(markup) || markup < 0 || markup > 10000) return { error: "Enter a markup from 0 to 10000 cents." };
  const minMiles = parseAdminMiles(formData.get("uber_direct_min_miles"));
  const maxMiles = parseAdminMiles(formData.get("uber_direct_max_miles"));
  if (!minMiles.ok || !maxMiles.ok) return { error: "Enter delivery distances between 0 and 500 miles, or leave blank." };
  if (minMiles.amount != null && maxMiles.amount != null && minMiles.amount > maxMiles.amount) {
    return { error: "Minimum miles cannot be greater than maximum miles." };
  }
  const { error } = await supabase.from("store_settings").update({
    uber_direct_enabled: formData.get("uber_direct_enabled") === "on",
    uber_direct_show_at_checkout: formData.get("uber_direct_show_at_checkout") === "on",
    uber_direct_production_dispatch: formData.get("uber_direct_production_dispatch") === "on",
    uber_direct_markup_cents: markup,
    uber_direct_min_miles: minMiles.amount,
    uber_direct_max_miles: maxMiles.amount,
  }).eq("id", STORE_SETTINGS_ID);
  if (error) return { error: "Uber Direct settings could not be saved." };
  revalidateUberAdmin();
  return { saved: true };
}

export async function checkUberDirectConnection(formData?: FormData) {
  void formData;
  const { supabase } = await requireAdmin();
  const creds = uberDirectCredentials();
  let status = "missing";
  let lastError: string | null = "Credentials are missing.";
  if (creds.configured && creds.environment === "unidentified") {
    status = "unidentified";
    lastError = "Set UBER_DIRECT_ENVIRONMENT to sandbox or production.";
  } else if (creds.configured) {
    try {
      await getUberAccessToken();
      status = "connected";
      lastError = null;
    } catch (error) {
      status = "failed";
      lastError = error instanceof Error ? error.message.replace(/Bearer\s+\S+/gi, "[redacted]").slice(0, 180) : "Authentication failed.";
    }
  }
  await supabase.from("delivery_provider_health").upsert({
    provider: "uber",
    status,
    last_check_at: new Date().toISOString(),
    last_error: lastError,
    updated_at: new Date().toISOString(),
  });
  await recordUberQuoteEvent({
    kind: "connection_check",
    message: status === "connected" ? "Authentication succeeded." : (lastError ?? status),
    environment: uberDirectEnvironment(),
    source: "admin",
  });
  revalidateUberAdmin();
}

export async function testUberDirectQuote(_prev: { error?: string; ok?: boolean; fee?: string; estimate?: string; total?: string } | null, formData: FormData) {
  const { supabase } = await requireAdmin();
  const { data: settings } = await supabase.from("store_settings").select("*").eq("id", STORE_SETTINGS_ID).maybeSingle();
  const origin = originFromSettings(settings);
  if (!originIsComplete(origin)) {
    return { error: `Complete the store origin first (${formatOriginLines(origin).join(", ") || "missing"}).` };
  }
  const dropoff = formatUberAddress({
    address_line_1: String(formData.get("dropoff_line1") ?? "").trim(),
    address_line_2: String(formData.get("dropoff_line2") ?? "").trim(),
    city: String(formData.get("dropoff_city") ?? "").trim(),
    state: String(formData.get("dropoff_state") ?? "").trim(),
    postal_code: String(formData.get("dropoff_postal") ?? "").trim(),
    country: String(formData.get("dropoff_country") ?? "US").trim() || "US",
  });
  const pickup = formatUberAddress(origin);
  if (!pickup || !dropoff) return { error: "Enter a complete US dropoff address for the test quote." };
  const gate = {
    enabled: settings?.uber_direct_enabled === true,
    showAtCheckout: settings?.uber_direct_show_at_checkout === true,
    productionDispatchDb: settings?.uber_direct_production_dispatch === true,
  };
  const quoted = await quoteUberDelivery({
    pickup,
    dropoff,
    markupCents: Number(settings?.uber_direct_markup_cents ?? 0),
  });
  await recordUberQuoteEvent({
    kind: quoted.option ? "admin_quote" : "quote_failure",
    message: quoted.option
      ? `Admin test quote $${quoted.option.amount.toFixed(2)}`
      : (quoted.unavailable ?? "Quote unavailable"),
    feeCents: quoted.option?.uberFeeCents ?? null,
    markupCents: quoted.option?.uberMarkupCents ?? null,
    environment: uberDirectEnvironment(),
    source: "admin",
  });
  revalidateUberAdmin();
  if (!quoted.option) {
    const blocker = explainUberCheckoutBlocker(gate) ?? quoted.unavailable ?? "Uber did not return a delivery price.";
    return { error: blocker };
  }
  return {
    ok: true,
    fee: `$${(quoted.option.uberFeeCents! / 100).toFixed(2)}`,
    estimate: quoted.option.estimate || undefined,
    total: `$${quoted.option.amount.toFixed(2)}`,
  };
}

export async function retryUberOrderDelivery(orderId: string) {
  await requireAdmin();
  const result = await retryUberDeliveryForOrder(orderId);
  revalidateUberAdmin();
  revalidatePath(`/admin/orders/${orderId}`);
  return result;
}

export async function cancelUberOrderDelivery(orderId: string) {
  await requireAdmin();
  const result = await cancelUberDeliveryForOrder(orderId);
  revalidateUberAdmin();
  revalidatePath(`/admin/orders/${orderId}`);
  return result;
}

export async function refreshCustomerUberDelivery(input: { orderId: string; guestToken?: string }) {
  const orderId = String(input.orderId ?? "");
  if (input.guestToken) {
    const guest = await getGuestOrderConfirmation(input.guestToken);
    if (guest.kind !== "found" || String(guest.order.order_id) !== orderId) return null;
  } else {
    const { supabase, user } = await requireUser();
    const { data } = await supabase.from("orders").select("id").eq("id", orderId).eq("user_id", user.id).maybeSingle();
    if (!data) return null;
  }
  await refreshUberDeliveryRecord(orderId);
  return readUberProgress(orderId);
}

export async function readUberProgress(orderId: string): Promise<UberProgress | null> {
  const admin = createAdminClient();
  if (!admin) return null;
  const { data } = await admin.from("uber_deliveries").select("status, tracking_url, courier_name, courier_phone, courier_vehicle, fee_cents, markup_cents, last_error, delivery_id").eq("order_id", orderId).maybeSingle();
  if (!data) return null;
  const stage = uberCustomerStage({ status: data.status, courierName: data.courier_name, booked: Boolean(data.delivery_id) });
  return {
    stage,
    status: data.status ?? "accepted",
    trackingUrl: data.tracking_url ?? null,
    courierName: data.courier_name ?? null,
    courierPhone: data.courier_phone ?? null,
    courierVehicle: data.courier_vehicle ?? null,
    feeCents: data.fee_cents ?? null,
    markupCents: data.markup_cents ?? null,
    lastError: data.last_error ?? null,
    deliveryId: data.delivery_id ?? null,
  };
}

export type UberProgress = {
  stage: UberCustomerStage;
  status: string;
  trackingUrl: string | null;
  courierName: string | null;
  courierPhone: string | null;
  courierVehicle: string | null;
  feeCents: number | null;
  markupCents: number | null;
  lastError: string | null;
  deliveryId: string | null;
};
