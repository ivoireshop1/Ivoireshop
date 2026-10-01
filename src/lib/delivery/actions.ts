"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/src/lib/auth/guards";
import { STORE_SETTINGS_ID } from "@/src/lib/store/constants";
import { createClient } from "@/src/lib/supabase/server";
import { collectCheckoutOptions } from "./orchestrate";
import { originFromSettings, originIsComplete } from "./origin";
import { doordashCredentials } from "./credentials";
import { verifyDoorDash } from "./providers/doordash";
import { sanitizeProviderError } from "./types";
import { parseCharge } from "./manual";
import { isCarrierOrder, validateCarrierTracking } from "./tracking";
import { parseTaxMode } from "@/src/lib/tax/totals";
import { notifyFulfillmentEmail } from "@/src/lib/communications/fulfillment-email";
import { recordFulfillmentNotification } from "@/src/lib/notifications/record";

export async function getCheckoutDeliveryOptions(input: {
  address: { address_line_1?: string; city?: string; state?: string; postal_code?: string; country?: string };
  items: { product_id: string; quantity: number }[];
}) {
  const supabase = await createClient();
  const ids = input.items.map((item) => item.product_id);
  const { data: products } = ids.length
    ? await supabase
        .from("products")
        .select("id, price, ship_weight_lb, ship_length_in, ship_width_in, ship_height_in")
        .in("id", ids)
    : { data: [] as Array<{ id: string; price: number | null }> };
  const byId = new Map((products ?? []).map((row) => [row.id, row]));
  return collectCheckoutOptions({
    destination: input.address,
    products: input.items.map((item) => ({ quantity: item.quantity, ...byId.get(item.product_id) })),
  });
}

function revalidateFulfillment(orderId?: string) {
  revalidatePath("/admin");
  revalidatePath("/admin/delivery");
  revalidatePath("/admin/orders");
  revalidatePath("/admin/payments");
  revalidatePath("/checkout");
  if (orderId) {
    revalidatePath(`/admin/orders/${orderId}`);
    revalidatePath(`/account/orders/${orderId}`);
  }
}

export async function saveStoreOrigin(_prev: { error?: string } | null, formData: FormData) {
  const { supabase } = await requireAdmin();
  const values = {
    origin_name: String(formData.get("origin_name") ?? "").trim(),
    origin_address_line_1: String(formData.get("origin_address_line_1") ?? "").trim(),
    origin_address_line_2: String(formData.get("origin_address_line_2") ?? "").trim(),
    origin_city: String(formData.get("origin_city") ?? "").trim(),
    origin_state: String(formData.get("origin_state") ?? "").trim(),
    origin_postal_code: String(formData.get("origin_postal_code") ?? "").trim(),
    origin_country: String(formData.get("origin_country") ?? "").trim() || "US",
    origin_phone: String(formData.get("origin_phone") ?? "").trim(),
    pickup_enabled: formData.get("pickup_enabled") === "on",
    store_delivery_enabled: formData.get("store_delivery_enabled") === "on",
    doordash_enabled: formData.get("doordash_enabled") === "on",
    ups_enabled: formData.get("ups_enabled") === "on",
    usps_enabled: formData.get("usps_enabled") === "on",
    doordash_max_radius_miles: Number(formData.get("doordash_max_radius_miles") || 0) || null,
    updated_at: new Date().toISOString(),
  };
  if (!originIsComplete(originFromSettings(values))) {
    return { error: "Enter store name, street, city, ZIP, and country." };
  }
  const { error } = await supabase.from("store_settings").update(values).eq("id", STORE_SETTINGS_ID);
  if (error) return { error: "Unable to save store origin." };
  revalidateFulfillment();
  return { error: undefined };
}

export async function saveManualShipping(_prev: { error?: string } | null, formData: FormData) {
  const { supabase } = await requireAdmin();
  const values = {
    ups_enabled: formData.get("ups_enabled") === "on",
    ups_domestic_enabled: formData.get("ups_domestic_enabled") === "on",
    ups_international_enabled: formData.get("ups_international_enabled") === "on",
    ups_domestic_charge: parseCharge(formData.get("ups_domestic_charge")),
    ups_international_charge: parseCharge(formData.get("ups_international_charge")),
    usps_enabled: formData.get("usps_enabled") === "on",
    usps_domestic_enabled: formData.get("usps_domestic_enabled") === "on",
    usps_international_enabled: formData.get("usps_international_enabled") === "on",
    usps_domestic_charge: parseCharge(formData.get("usps_domestic_charge")),
    usps_international_charge: parseCharge(formData.get("usps_international_charge")),
    updated_at: new Date().toISOString(),
  };
  if (values.ups_enabled && values.ups_domestic_enabled && values.ups_domestic_charge == null) {
    return { error: "Enter a UPS domestic shipping charge, or turn domestic UPS off." };
  }
  if (values.ups_enabled && values.ups_international_enabled && values.ups_international_charge == null) {
    return { error: "Enter a UPS international shipping charge, or turn international UPS off." };
  }
  if (values.usps_enabled && values.usps_domestic_enabled && values.usps_domestic_charge == null) {
    return { error: "Enter a USPS domestic shipping charge, or turn domestic USPS off." };
  }
  if (values.usps_enabled && values.usps_international_enabled && values.usps_international_charge == null) {
    return { error: "Enter a USPS international shipping charge, or turn international USPS off." };
  }
  const { error } = await supabase.from("store_settings").update(values).eq("id", STORE_SETTINGS_ID);
  if (error) return { error: "Unable to save manual shipping charges." };
  revalidateFulfillment();
  return { error: undefined };
}

export async function saveTaxSettings(_prev: { error?: string } | null, formData: FormData) {
  const { supabase } = await requireAdmin();
  const tax_mode = parseTaxMode(String(formData.get("tax_mode") ?? ""));
  const rate = Number(formData.get("tax_rate_percent"));
  if (tax_mode === "manual_rate" && (!Number.isFinite(rate) || rate < 0 || rate > 100)) {
    return { error: "Enter a tax rate between 0 and 100." };
  }
  const { error } = await supabase.from("store_settings").update({
    tax_mode,
    tax_rate_percent: tax_mode === "manual_rate" ? rate : null,
    tax_applies_to_shipping: formData.get("tax_applies_to_shipping") === "on",
    tax_name: String(formData.get("tax_name") ?? "Tax").trim() || "Tax",
    updated_at: new Date().toISOString(),
  }).eq("id", STORE_SETTINGS_ID);
  if (error) return { error: "Unable to save tax settings." };
  revalidateFulfillment();
  return { error: undefined };
}

export async function saveOrderShipment(formData: FormData) {
  const { supabase } = await requireAdmin();
  const id = String(formData.get("id") ?? "").trim();
  const trackingRaw = String(formData.get("tracking_number") ?? "");
  const markShipped = formData.get("mark_shipped") === "on" || formData.get("mark_shipped") === "true";
  if (!id) redirect("/admin/orders?error=invalid_status");
  const { data: order, error: readError } = await supabase
    .from("orders")
    .select("id, status, fulfillment_method, fulfillment_provider, tracking_number")
    .eq("id", id)
    .maybeSingle();
  if (readError || !order || !isCarrierOrder(order.fulfillment_provider)) {
    redirect(`/admin/orders/${id}?error=invalid_shipment`);
  }
  const checked = validateCarrierTracking(order.fulfillment_provider || "", trackingRaw);
  if (!checked.ok) redirect(`/admin/orders/${id}?error=invalid_tracking`);
  const patch: Record<string, unknown> = { tracking_number: checked.tracking };
  if (markShipped) {
    const allowed = ["pending", "confirmed", "processing", "shipped"].includes(order.status);
    if (!allowed) {
      redirect(`/admin/orders/${id}?error=invalid_transition`);
    }
    patch.status = "shipped";
    patch.shipped_at = new Date().toISOString();
  }
  const { data: changed, error } = await supabase.from("orders").update(patch).eq("id", id).select("id").maybeSingle();
  if (error || !changed) redirect(`/admin/orders/${id}?error=status_update_failed`);
  if (markShipped && order.status !== "shipped") {
    const emailSent = await notifyFulfillmentEmail(supabase, id, "shipped");
    await recordFulfillmentNotification(supabase, id, "shipped", Boolean(emailSent));
  }
  revalidateFulfillment(id);
  redirect(`/admin/orders/${id}?success=shipment_updated`);
}

export async function checkDeliveryProviders(): Promise<void> {
  const { supabase } = await requireAdmin();
  const creds = doordashCredentials();
  const verified = creds.configured ? await verifyDoorDash() : { ok: false, error: "Not configured" };
  const status = !creds.configured ? "not_configured" : verified.ok ? "connected" : "error";
  const last_error = verified.ok ? null : sanitizeProviderError(verified.error ?? "Error");
  await supabase.from("delivery_provider_health").upsert({
    provider: "doordash",
    status,
    last_check_at: new Date().toISOString(),
    last_error,
    updated_at: new Date().toISOString(),
  });
  await supabase.from("delivery_operation_logs").insert({
    provider: "doordash",
    operation: "health_check",
    success: verified.ok,
    message: last_error,
  });
  for (const provider of ["ups", "usps"] as const) {
    await supabase.from("delivery_provider_health").upsert({
      provider,
      status: "manual",
      last_check_at: new Date().toISOString(),
      last_error: null,
      updated_at: new Date().toISOString(),
    });
  }
  revalidatePath("/admin/delivery");
}

export async function carrierOrderCounts() {
  const { supabase } = await requireAdmin();
  const { data, error } = await supabase
    .from("orders")
    .select("id, status, fulfillment_provider, tracking_number, shipped_at");
  if (error) throw new Error("Unable to load shipping counts.");
  const rows = (data ?? []).filter((row) => isCarrierOrder(row.fulfillment_provider));
  return {
    awaiting: rows.filter((row) => !["shipped", "delivered", "cancelled"].includes(row.status)).length,
    shipped: rows.filter((row) => row.status === "shipped").length,
    missingTracking: rows.filter((row) => !row.tracking_number && row.status !== "cancelled").length,
  };
}
