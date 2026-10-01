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
import { parseAdminMiles, parseAdminMoney, parseRateMode } from "./manual";
import { recordAdminIncident } from "@/src/lib/ops/incident";
import { isCarrierOrder, validateCarrierTracking } from "./tracking";
import { parseTaxMode } from "@/src/lib/tax/totals";
import { notifyFulfillmentEmail } from "@/src/lib/communications/fulfillment-email";
import { recordCustomerNotification, recordFulfillmentNotification } from "@/src/lib/notifications/record";

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

async function persistStoreSettings(
  supabase: Awaited<ReturnType<typeof requireAdmin>>["supabase"],
  values: Record<string, unknown>,
  feature: string,
) {
  const { data, error } = await supabase
    .from("store_settings")
    .update(values)
    .eq("id", STORE_SETTINGS_ID)
    .select("id")
    .maybeSingle();
  if (error || !data) {
    recordAdminIncident({
      route: "/admin/delivery",
      feature,
      category: "database",
      safeCode: "DELIVERY_SAVE",
    });
    return false;
  }
  return true;
}

export async function saveStoreOrigin(_prev: { error?: string; saved?: boolean } | null, formData: FormData) {
  const { supabase } = await requireAdmin();
  const radius = parseAdminMiles(formData.get("doordash_max_radius_miles"));
  const charge = parseAdminMoney(formData.get("store_delivery_charge"));
  if (!radius.ok) return { error: "Enter a local radius between 0 and 500 miles.", saved: false };
  if (!charge.ok) return { error: "Enter a valid local delivery charge of $0.00 or more.", saved: false };
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
    pickup_show_at_checkout: formData.get("pickup_show_at_checkout") === "on",
    store_delivery_enabled: formData.get("store_delivery_enabled") === "on",
    store_delivery_show_at_checkout: formData.get("store_delivery_show_at_checkout") === "on",
    store_delivery_charge: charge.amount ?? 0,
    doordash_enabled: formData.get("doordash_enabled") === "on",
    doordash_max_radius_miles: radius.amount,
    updated_at: new Date().toISOString(),
  };
  if (!originIsComplete(originFromSettings(values))) {
    return { error: "Enter store name, street, city, ZIP, and country.", saved: false };
  }
  const saved = await persistStoreSettings(supabase, values, "store_origin");
  if (!saved) return { error: "Couldn’t save changes", saved: false };
  revalidateFulfillment();
  return { saved: true };
}

export async function saveManualShipping(_prev: { error?: string; saved?: boolean } | null, formData: FormData) {
  const { supabase } = await requireAdmin();
  const moneyFields = [
    "ups_domestic_charge",
    "ups_international_charge",
    "ups_handling_fee",
    "ups_free_shipping_threshold",
    "usps_domestic_charge",
    "usps_international_charge",
    "usps_handling_fee",
    "usps_free_shipping_threshold",
  ] as const;
  const parsedMoney: Record<(typeof moneyFields)[number], number | null> = {
    ups_domestic_charge: null,
    ups_international_charge: null,
    ups_handling_fee: null,
    ups_free_shipping_threshold: null,
    usps_domestic_charge: null,
    usps_international_charge: null,
    usps_handling_fee: null,
    usps_free_shipping_threshold: null,
  };
  for (const field of moneyFields) {
    const parsed = parseAdminMoney(formData.get(field));
    if (!parsed.ok) return { error: "Enter valid amounts of $0.00 or more. Negative or malformed currency is not allowed.", saved: false };
    parsedMoney[field] = parsed.amount;
  }
  const values = {
    ups_enabled: formData.get("ups_enabled") === "on",
    ups_show_at_checkout: formData.get("ups_show_at_checkout") === "on",
    ups_domestic_enabled: formData.get("ups_domestic_enabled") === "on",
    ups_international_enabled: formData.get("ups_international_enabled") === "on",
    ups_domestic_charge: parsedMoney.ups_domestic_charge,
    ups_international_charge: parsedMoney.ups_international_charge,
    ups_handling_fee: parsedMoney.ups_handling_fee,
    ups_free_shipping_threshold: parsedMoney.ups_free_shipping_threshold,
    ups_rate_mode: parseRateMode(formData.get("ups_rate_mode")),
    usps_enabled: formData.get("usps_enabled") === "on",
    usps_show_at_checkout: formData.get("usps_show_at_checkout") === "on",
    usps_domestic_enabled: formData.get("usps_domestic_enabled") === "on",
    usps_international_enabled: formData.get("usps_international_enabled") === "on",
    usps_domestic_charge: parsedMoney.usps_domestic_charge,
    usps_international_charge: parsedMoney.usps_international_charge,
    usps_handling_fee: parsedMoney.usps_handling_fee,
    usps_free_shipping_threshold: parsedMoney.usps_free_shipping_threshold,
    usps_rate_mode: parseRateMode(formData.get("usps_rate_mode")),
    updated_at: new Date().toISOString(),
  };
  const needsCharge = (enabled: boolean, show: boolean, mode: string, zoneOn: boolean, charge: number | null) =>
    enabled && show && mode !== "live_api" && zoneOn && charge == null;
  if (needsCharge(values.ups_enabled, values.ups_show_at_checkout, values.ups_rate_mode, values.ups_domestic_enabled, values.ups_domestic_charge)) {
    return { error: "Enter a UPS domestic shipping charge, or turn domestic UPS off.", saved: false };
  }
  if (needsCharge(values.ups_enabled, values.ups_show_at_checkout, values.ups_rate_mode, values.ups_international_enabled, values.ups_international_charge)) {
    return { error: "Enter a UPS international shipping charge, or turn international UPS off.", saved: false };
  }
  if (needsCharge(values.usps_enabled, values.usps_show_at_checkout, values.usps_rate_mode, values.usps_domestic_enabled, values.usps_domestic_charge)) {
    return { error: "Enter a USPS domestic shipping charge, or turn domestic USPS off.", saved: false };
  }
  if (needsCharge(values.usps_enabled, values.usps_show_at_checkout, values.usps_rate_mode, values.usps_international_enabled, values.usps_international_charge)) {
    return { error: "Enter a USPS international shipping charge, or turn international USPS off.", saved: false };
  }
  const saved = await persistStoreSettings(supabase, values, "manual_shipping");
  if (!saved) return { error: "Couldn’t save changes", saved: false };
  revalidateFulfillment();
  return { saved: true };
}

export async function saveTaxSettings(_prev: { error?: string; saved?: boolean } | null, formData: FormData) {
  const { supabase } = await requireAdmin();
  const tax_mode = parseTaxMode(String(formData.get("tax_mode") ?? ""));
  const rate = Number(formData.get("tax_rate_percent"));
  if (tax_mode === "manual_rate" && (!Number.isFinite(rate) || rate < 0 || rate > 100)) {
    return { error: "Enter a tax rate between 0 and 100." };
  }
  const saved = await persistStoreSettings(supabase, {
    tax_mode,
    tax_rate_percent: tax_mode === "manual_rate" ? rate : null,
    tax_applies_to_shipping: formData.get("tax_applies_to_shipping") === "on",
    tax_name: String(formData.get("tax_name") ?? "Tax").trim() || "Tax",
    updated_at: new Date().toISOString(),
  }, "tax_settings");
  if (!saved) return { error: "Couldn’t save changes", saved: false };
  revalidateFulfillment();
  return { saved: true };
}

export async function saveOrderShipment(formData: FormData) {
  const { supabase } = await requireAdmin();
  const id = String(formData.get("id") ?? "").trim();
  const trackingRaw = String(formData.get("tracking_number") ?? "");
  const markShipped = formData.get("mark_shipped") === "on" || formData.get("mark_shipped") === "true";
  if (!id) redirect("/admin/orders?error=invalid_status");
  const { data: order, error: readError } = await supabase
    .from("orders")
    .select("id, status, fulfillment_method, fulfillment_provider, tracking_number, shipping_cost")
    .eq("id", id)
    .maybeSingle();
  if (readError || !order || !isCarrierOrder(order.fulfillment_provider)) {
    redirect(`/admin/orders/${id}?error=invalid_shipment`);
  }
  const checked = validateCarrierTracking(order.fulfillment_provider || "", trackingRaw);
  if (!checked.ok) redirect(`/admin/orders/${id}?error=invalid_tracking`);
  const postageRaw = String(formData.get("postage_cost") ?? "").trim();
  const postageParsed = postageRaw ? parseAdminMoney(postageRaw) : { ok: true as const, amount: null };
  if (postageRaw && !postageParsed.ok) redirect(`/admin/orders/${id}?error=invalid_postage`);
  const postage = postageParsed.ok ? postageParsed.amount : null;
  const patch: Record<string, unknown> = { tracking_number: checked.tracking };
  if (postage != null) patch.postage_cost = postage;
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
  const hadTracking = Boolean(order.tracking_number);
  if (!hadTracking && checked.tracking) {
    await recordCustomerNotification(supabase, id, "tracking_added");
  }
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
  if (error) {
    recordAdminIncident({ route: "/admin/delivery", feature: "shipping_counts", category: "database", safeCode: "DELIVERY_COUNTS" });
    return { ok: false as const, awaiting: null as number | null, shipped: null as number | null, missingTracking: null as number | null };
  }
  const rows = (data ?? []).filter((row) => isCarrierOrder(row.fulfillment_provider));
  return {
    ok: true as const,
    awaiting: rows.filter((row) => !["shipped", "delivered", "cancelled"].includes(row.status)).length,
    shipped: rows.filter((row) => row.status === "shipped").length,
    missingTracking: rows.filter((row) => !row.tracking_number && row.status !== "cancelled").length,
  };
}
