"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin, requireUser } from "@/src/lib/auth/guards";
import { STORE_SETTINGS_ID } from "@/src/lib/store/constants";
import { createAdminClient } from "@/src/lib/supabase/admin";
import { getGuestOrderConfirmation } from "@/src/lib/checkout/guest-order";
import { uberDirectCredentials } from "./credentials";
import { getUberAccessToken } from "./providers/uber-direct";
import { cancelUberDeliveryForOrder, refreshUberDeliveryRecord } from "./uber-dispatch";
import { uberCustomerStage, type UberCustomerStage } from "./uber-status";

export async function saveUberDirectSettings(_prev: { error?: string; saved?: boolean } | null, formData: FormData) {
  const { supabase } = await requireAdmin();
  const markup = Number(String(formData.get("uber_direct_markup_cents") ?? "0").trim());
  if (!Number.isInteger(markup) || markup < 0 || markup > 10000) return { error: "Enter a markup from 0 to 10000 cents." };
  const { error } = await supabase.from("store_settings").update({
    uber_direct_enabled: formData.get("uber_direct_enabled") === "on",
    uber_direct_show_at_checkout: formData.get("uber_direct_show_at_checkout") === "on",
    uber_direct_production_dispatch: formData.get("uber_direct_production_dispatch") === "on",
    uber_direct_markup_cents: markup,
  }).eq("id", STORE_SETTINGS_ID);
  if (error) return { error: "Uber Direct settings could not be saved." };
  revalidatePath("/admin/delivery");
  return { saved: true };
}

export async function checkUberDirectConnection() {
  const { supabase } = await requireAdmin();
  const creds = uberDirectCredentials();
  const status = !creds.configured
    ? "missing"
    : creds.environment === "unidentified"
      ? "unidentified"
      : await getUberAccessToken().then(() => "connected", () => "failed");
  await supabase.from("delivery_provider_health").upsert({
    provider: "uber",
    status,
    last_check_at: new Date().toISOString(),
    last_error: status === "connected" ? null : status === "missing" ? "Credentials are missing." : status === "unidentified" ? "Set UBER_DIRECT_ENVIRONMENT to sandbox or production." : "Authentication failed.",
    updated_at: new Date().toISOString(),
  });
  revalidatePath("/admin/delivery");
  return { status };
}

export async function cancelUberOrderDelivery(orderId: string) {
  await requireAdmin();
  const result = await cancelUberDeliveryForOrder(orderId);
  revalidatePath("/admin/delivery");
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
