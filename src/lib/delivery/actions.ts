"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/src/lib/auth/guards";
import { STORE_SETTINGS_ID } from "@/src/lib/store/constants";
import { createClient } from "@/src/lib/supabase/server";
import { collectCheckoutOptions } from "./orchestrate";
import { originFromSettings, originIsComplete } from "./origin";
import { doordashCredentials, upsCredentials, uspsCredentials } from "./credentials";
import { verifyDoorDash } from "./providers/doordash";
import { verifyUps } from "./providers/ups";
import { verifyUsps } from "./providers/usps";
import { sanitizeProviderError } from "./types";

export async function getCheckoutDeliveryOptions(input: {
  address: { address_line_1?: string; city?: string; state?: string; postal_code?: string; country?: string };
  items: { product_id: string; quantity: number }[];
}) {
  const supabase = await createClient();
  const ids = input.items.map((item) => item.product_id);
  const { data: products } = ids.length
    ? await supabase
        .from("products")
        .select("id, ship_weight_lb, ship_length_in, ship_width_in, ship_height_in")
        .in("id", ids)
    : { data: [] as Array<{ id: string; ship_weight_lb: number | null }> };
  const byId = new Map((products ?? []).map((row) => [row.id, row]));
  return collectCheckoutOptions({
    destination: input.address,
    products: input.items.map((item) => ({ quantity: item.quantity, ...byId.get(item.product_id) })),
  });
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
  revalidatePath("/admin/delivery");
  return { error: undefined };
}

export async function checkDeliveryProviders(): Promise<void> {
  const { supabase } = await requireAdmin();
  const checks = [
    { provider: "doordash", configured: doordashCredentials().configured, verify: verifyDoorDash },
    { provider: "ups", configured: upsCredentials().configured, verify: verifyUps },
    { provider: "usps", configured: uspsCredentials().configured, verify: verifyUsps },
  ] as const;
  for (const check of checks) {
    const verified = check.configured ? await check.verify() : { ok: false, error: "Not configured" };
    const status = !check.configured ? "not_configured" : verified.ok ? "connected" : "error";
    const last_error = verified.ok ? null : sanitizeProviderError(verified.error ?? "Error");
    console.info("[delivery]", {
      provider: check.provider,
      operation: "health_check",
      success: verified.ok,
      timestamp: new Date().toISOString(),
      message: last_error || undefined,
    });
    await supabase.from("delivery_provider_health").upsert({
      provider: check.provider,
      status,
      last_check_at: new Date().toISOString(),
      last_error,
      updated_at: new Date().toISOString(),
    });
    await supabase.from("delivery_operation_logs").insert({
      provider: check.provider,
      operation: "health_check",
      success: verified.ok,
      message: last_error,
    });
  }
  revalidatePath("/admin/delivery");
}
