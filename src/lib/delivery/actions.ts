"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/src/lib/auth/guards";
import { STORE_SETTINGS_ID } from "@/src/lib/store/constants";
import { createClient } from "@/src/lib/supabase/server";
import { collectCheckoutOptions } from "./orchestrate";
import { formatOriginLines, originFromSettings, originIsComplete } from "./origin";
import { estimateIvoireShipping, ivoireShippingConfigFromRow } from "@/src/lib/shipping/estimate";
import { doordashCredentials } from "./credentials";
import { verifyDoorDash } from "./providers/doordash";
import { sanitizeProviderError } from "./types";
import { parseAdminMiles, parseAdminMoney, parseRateMode } from "./manual";
import { canPrepareShippoLabel, createShippoTestTransaction, listShippoCarrierAccounts, shippoCredentials } from "@/src/lib/shipping/shippo";
import { quoteLiveCarrierOptions } from "@/src/lib/shipping/live-quotes";
import { recordShippingMonitorEvent } from "@/src/lib/shipping/monitor";
import { isPersistentImageUrl } from "@/src/lib/catalog/image-url";
import { recordAdminIncident } from "@/src/lib/ops/incident";
import { isCarrierOrder, validateCarrierTracking } from "./tracking";
import { notifyFulfillmentEmail } from "@/src/lib/communications/fulfillment-email";
import { recordCustomerNotification, recordFulfillmentNotification } from "@/src/lib/notifications/record";
import { computeOrderTotalCents, computeTaxLines, moneyFromCents, safeUsdToCents, taxSettingsFromRow } from "@/src/lib/tax/totals";

type CheckoutProductRow = {
  id: string;
  price: number | null;
  selling_method?: string | null;
  selling_unit?: string | null;
  unit_increment?: number | string | null;
  min_sell_qty?: number | string | null;
  max_sell_qty?: number | string | null;
  package_weight_lb?: number | string | null;
  ship_weight_lb?: number | string | null;
  ship_length_in?: number | string | null;
  ship_width_in?: number | string | null;
  ship_height_in?: number | string | null;
};

async function loadCheckoutProducts(items: { product_id: string; quantity: number }[]) {
  const supabase = await createClient();
  const ids = items.map((item) => item.product_id);
  const { data: products } = ids.length
    ? await supabase
        .from("products")
        .select("id, price, selling_method, selling_unit, unit_increment, min_sell_qty, max_sell_qty, package_weight_lb, ship_weight_lb, ship_length_in, ship_width_in, ship_height_in")
        .in("id", ids)
    : { data: [] as CheckoutProductRow[] };
  const byId = new Map((products ?? []).map((row) => [row.id, row as CheckoutProductRow]));
  return items.map((item) => {
    const row = byId.get(item.product_id);
    return row ? { quantity: item.quantity, ...row } : { quantity: item.quantity, id: item.product_id, price: null as number | null };
  });
}

export async function getCheckoutDeliveryOptions(input: {
  address: { address_line_1?: string; city?: string; state?: string; postal_code?: string; country?: string };
  items: { product_id: string; quantity: number }[];
  /** Default true. Pass false for fast pickup/store/Ivoire options without waiting on Shippo. */
  includeLiveCarriers?: boolean;
}) {
  const started = Date.now();
  const products = await loadCheckoutProducts(input.items);
  const result = await collectCheckoutOptions({
    destination: input.address,
    products,
    includeLiveCarriers: input.includeLiveCarriers,
  });
  console.info("[checkout-timing]", {
    action: "getCheckoutDeliveryOptions",
    includeLiveCarriers: input.includeLiveCarriers !== false,
    ms: Date.now() - started,
    optionCount: result.options.length,
  });
  return result;
}

/** Live UPS/USPS only — merge into an existing fast quote on the client. */
export async function getCheckoutLiveCarrierOptions(input: {
  address: { address_line_1?: string; city?: string; state?: string; postal_code?: string; country?: string };
  items: { product_id: string; quantity: number }[];
}) {
  const started = Date.now();
  const supabase = await createClient();
  const { data: settings } = await supabase.from("store_settings").select("*").eq("id", STORE_SETTINGS_ID).maybeSingle();
  const origin = originFromSettings(settings);
  const products = await loadCheckoutProducts(input.items);
  const live = await quoteLiveCarrierOptions({
    settings: settings as Record<string, unknown> | null,
    origin,
    destination: input.address,
    products,
  });
  const tax = taxSettingsFromRow(settings as Record<string, unknown> | null);
  const subtotalCents = products.reduce((sum, product) => {
    const qty = Number(product.quantity);
    const price = Number(product.price);
    if (!Number.isFinite(qty) || qty <= 0 || !Number.isFinite(price) || price <= 0) return sum;
    return sum + Math.round(price * qty * 100);
  }, 0);
  const breakdowns: Record<string, { shipping: number; tax: number; total: number; taxLines: ReturnType<typeof computeTaxLines> }> = {};
  for (const option of live.options) {
    const shippingCents = safeUsdToCents(option.amount);
    const taxLines = computeTaxLines({ subtotalCents, discountCents: 0, shippingCents, tax });
    const taxCents = taxLines.reduce((sum, line) => sum + line.cents, 0);
    breakdowns[option.id] = {
      shipping: moneyFromCents(shippingCents),
      tax: moneyFromCents(taxCents),
      taxLines,
      total: moneyFromCents(computeOrderTotalCents({ subtotalCents, discountCents: 0, shippingCents, taxCents })),
    };
  }
  console.info("[checkout-timing]", {
    action: "getCheckoutLiveCarrierOptions",
    ms: Date.now() - started,
    rates: live.options.length,
    expected: live.expectedLiveCarriers,
    temporaryBusy: live.temporaryBusy === true,
    rateLimited: live.rateLimitedCarriers,
  });
  return { ...live, breakdowns, subtotal: moneyFromCents(subtotalCents) };
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
    revalidatePath("/account");
    revalidatePath("/account/notifications");
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
  if (!saved) return { error: "Couldn’t save shipping settings. Stay on this page and try again, or sign in as an admin.", saved: false };
  revalidateFulfillment();
  return { saved: true };
}

export async function saveShippoSettings(_prev: { error?: string; saved?: boolean } | null, formData: FormData) {
  const { supabase } = await requireAdmin();
  if (formData.get("postage_purchases_enabled") === "on") {
    return { error: "Live postage purchasing is disabled in this phase and requires founder approval.", saved: false };
  }
  const margin = Number(formData.get("shippo_margin_percent"));
  if (formData.get("shippo_margin_percent") && (!Number.isFinite(margin) || margin < 0 || margin > 200)) {
    return { error: "Margin must be between 0 and 200%.", saved: false };
  }
  const logo = String(formData.get("packing_slip_logo_url") ?? "").trim();
  if (logo && !isPersistentImageUrl(logo)) {
    return { error: "Use a site path or a stored image URL for the packing-slip logo.", saved: false };
  }
  const saved = await persistStoreSettings(supabase, {
    shippo_enabled: formData.get("shippo_enabled") === "on",
    shippo_allow_manual_fallback: formData.get("shippo_allow_manual_fallback") === "on",
    postage_purchases_enabled: false,
    shippo_margin_percent: Number.isFinite(margin) ? margin : 0,
    shippo_allowed_services: String(formData.get("shippo_allowed_services") ?? "").trim(),
    shippo_international_countries: String(formData.get("shippo_international_countries") ?? "").trim().toUpperCase(),
    packing_slip_watermark_text: String(formData.get("packing_slip_watermark_text") ?? "IVOIRE SHOP").trim() || "IVOIRE SHOP",
    packing_slip_logo_url: logo || null,
    updated_at: new Date().toISOString(),
  }, "shippo_settings");
  if (!saved) return { error: "Couldn’t save Shippo settings. Confirm the shipping schema is applied.", saved: false };
  revalidateFulfillment();
  return { saved: true };
}

export type ShippoLabelState = { error?: string; saved?: boolean; labelUrl?: string | null; trackingNumber?: string | null };

export async function prepareShippoTestLabel(_prev: ShippoLabelState | null, formData: FormData): Promise<ShippoLabelState> {
  const { supabase } = await requireAdmin();
  const id = String(formData.get("id") ?? "").trim();
  if (!id) return { error: "Order is missing." };
  const creds = shippoCredentials();
  const { data: settings } = await supabase.from("store_settings").select("*").eq("id", STORE_SETTINGS_ID).maybeSingle();
  if (!canPrepareShippoLabel({ isTest: creds.isTest, postagePurchasesEnabled: Boolean(settings?.postage_purchases_enabled) })) {
    await recordShippingMonitorEvent("label_blocked", { reason: creds.isLive ? "live_token" : "postage_disabled" });
    return { error: "Live postage purchasing is disabled. Test labels are only prepared with a Shippo test token." };
  }
  const { data: order } = await supabase
    .from("orders")
    .select("id, shipping_address, fulfillment_provider, fulfillment_service, delivery_snapshot, is_demo")
    .eq("id", id)
    .maybeSingle();
  if (!order) return { error: "That order could not be found." };
  const dest = (order.shipping_address ?? {}) as { address_line_1?: string; city?: string; state?: string; postal_code?: string; country?: string };
  const { data: items } = await supabase.from("order_items").select("quantity, product_id").eq("order_id", id);
  const ids = (items ?? []).map((item) => item.product_id).filter(Boolean);
  const { data: products } = ids.length
    ? await supabase.from("products").select("id, selling_method, selling_unit, unit_increment, min_sell_qty, max_sell_qty, package_weight_lb, ship_weight_lb, ship_length_in, ship_width_in, ship_height_in").in("id", ids)
    : { data: [] as Array<{ id: string }> };
  const byId = new Map((products ?? []).map((row) => [row.id, row]));
  const origin = originFromSettings(settings);
  const quoted = await quoteLiveCarrierOptions({
    settings: settings as Record<string, unknown> | null,
    origin,
    destination: dest,
    products: (items ?? []).map((item) => ({ quantity: item.quantity, ...byId.get(item.product_id) })),
  });
  const match = quoted.options.find((option) =>
    option.provider === order.fulfillment_provider && option.serviceCode === order.fulfillment_service,
  ) ?? quoted.options.find((option) => option.provider === order.fulfillment_provider);
  if (!match?.shippoRateId) {
    return { error: "A matching Shippo test rate was not available for this order. Missing parcel data is never invented." };
  }
  const created = await createShippoTestTransaction(match.shippoRateId, Boolean(settings?.postage_purchases_enabled));
  if (!created.ok) {
    await recordShippingMonitorEvent("label_blocked", { reason: "transaction_failed" });
    return { error: created.error };
  }
  const snapshot = {
    ...((order.delivery_snapshot && typeof order.delivery_snapshot === "object") ? order.delivery_snapshot as Record<string, unknown> : {}),
    shippo_label_url: created.labelUrl,
    shippo_transaction_id: created.transactionId,
    test_rate: true,
    postage_purchased: false,
  };
  const tracking = created.trackingNumber ? validateCarrierTracking(order.fulfillment_provider || "", created.trackingNumber) : null;
  const patch: Record<string, unknown> = { delivery_snapshot: snapshot };
  if (tracking?.ok) patch.tracking_number = tracking.tracking;
  const { error } = await supabase.from("orders").update(patch).eq("id", id);
  if (error) return { error: "The test label was created but could not be saved on the order." };
  revalidateFulfillment(id);
  return { saved: true, labelUrl: created.labelUrl, trackingNumber: tracking?.ok ? tracking.tracking : created.trackingNumber };
}

function parseTaxRule(formData: FormData, prefix: "tax_1" | "tax_2") {
  const enabled = formData.get(`${prefix}_enabled`) === "on";
  const name = String(formData.get(`${prefix}_name`) ?? "").trim() || (prefix === "tax_1" ? "Tax 1" : "Tax 2");
  const rateRaw = String(formData.get(`${prefix}_rate_percent`) ?? "").trim();
  const rate = Number(rateRaw);
  if (enabled && (!Number.isFinite(rate) || rate < 0 || rate > 100)) {
    return { error: `Enter a ${name} rate between 0 and 100.` as const };
  }
  return {
    enabled,
    name,
    rate: enabled ? rate : null,
    shipping: formData.get(`${prefix}_applies_to_shipping`) === "on",
  };
}

export async function saveTaxSettings(_prev: { error?: string; saved?: boolean } | null, formData: FormData) {
  const { supabase } = await requireAdmin();
  const tax1 = parseTaxRule(formData, "tax_1");
  const tax2 = parseTaxRule(formData, "tax_2");
  if ("error" in tax1 && tax1.error) return { error: tax1.error };
  if ("error" in tax2 && tax2.error) return { error: tax2.error };
  if (!("enabled" in tax1) || !("enabled" in tax2)) return { error: "Couldn’t save changes", saved: false };
  const anyOn = tax1.enabled || tax2.enabled;
  const primary = tax1.enabled ? tax1 : tax2.enabled ? tax2 : null;
  const saved = await persistStoreSettings(supabase, {
    tax_1_enabled: tax1.enabled,
    tax_1_name: tax1.name,
    tax_1_rate_percent: tax1.rate,
    tax_1_applies_to_shipping: tax1.shipping,
    tax_2_enabled: tax2.enabled,
    tax_2_name: tax2.name,
    tax_2_rate_percent: tax2.rate,
    tax_2_applies_to_shipping: tax2.shipping,
    tax_mode: anyOn ? "manual_rate" : "no_tax",
    tax_rate_percent: primary?.rate ?? null,
    tax_applies_to_shipping: primary?.shipping ?? false,
    tax_name: primary?.name ?? "Tax",
    updated_at: new Date().toISOString(),
  }, "tax_settings");
  if (!saved) return { error: "Couldn’t save changes", saved: false };
  revalidateFulfillment();
  return { saved: true };
}

function moneyField(formData: FormData, name: string) {
  const parsed = parseAdminMoney(formData.get(name));
  return parsed;
}

export async function saveIvoireShippingSettings(_prev: { error?: string; saved?: boolean } | null, formData: FormData) {
  const { supabase } = await requireAdmin();
  const markup = Number(formData.get("ivoire_shipping_markup_percent"));
  const fallback = moneyField(formData, "ivoire_shipping_fallback_amount");
  const maxWeight = Number(formData.get("ivoire_shipping_max_weight_lb"));
  const handling = moneyField(formData, "ivoire_shipping_handling_fee");
  const minCharge = moneyField(formData, "ivoire_shipping_min_charge");
  const maxCharge = moneyField(formData, "ivoire_shipping_max_charge");
  if (formData.get("ivoire_shipping_markup_percent") && (!Number.isFinite(markup) || markup < 0 || markup > 200)) {
    return { error: "Markup must be between 0 and 200%.", saved: false };
  }
  if (!fallback.ok || !handling.ok || !minCharge.ok || !maxCharge.ok) {
    return { error: "Enter valid dollar amounts for handling, fallback, and min/max charges.", saved: false };
  }
  const saved = await persistStoreSettings(supabase, {
    ivoire_shipping_enabled: formData.get("ivoire_shipping_enabled") === "on",
    ivoire_shipping_markup_percent: Number.isFinite(markup) ? markup : 0,
    ivoire_shipping_fallback_amount: fallback.amount,
    ivoire_shipping_max_weight_lb: Number.isFinite(maxWeight) && maxWeight > 0 ? maxWeight : null,
    ivoire_shipping_config: {
      dim_divisor: Number(formData.get("ivoire_shipping_dim_divisor") || 166) || 166,
      handling_fee: handling.amount ?? 0,
      min_charge: minCharge.amount,
      max_charge: maxCharge.amount,
      require_us_zip: formData.get("ivoire_require_us_zip") === "on",
      missing_info_policy: formData.get("ivoire_missing_info_policy") === "block" ? "block" : "fallback",
      invalid_zip_policy: formData.get("ivoire_invalid_zip_policy") === "fallback" ? "fallback" : "block",
      package_defaults: {
        weight_lb: Number(formData.get("default_weight_lb") || 1) || 1,
        length_in: Number(formData.get("default_length_in") || 10) || 10,
        width_in: Number(formData.get("default_width_in") || 8) || 8,
        height_in: Number(formData.get("default_height_in") || 6) || 6,
      },
      zones: [
        {
          id: "domestic",
          name: "United States",
          match: "domestic",
          base_rate: Number(formData.get("zone_domestic_base") || 8.5),
          per_lb: Number(formData.get("zone_domestic_per_lb") || 0.85),
          surcharge: Number(formData.get("zone_domestic_surcharge") || 0),
          min_weight_lb: 0,
          max_weight_lb: Number(formData.get("zone_domestic_max") || 70),
          zip_prefixes: String(formData.get("zone_domestic_zips") || ""),
          is_active: formData.get("zone_domestic_enabled") === "on",
        },
        {
          id: "international",
          name: "International",
          match: "international",
          base_rate: Number(formData.get("zone_international_base") || 24),
          per_lb: Number(formData.get("zone_international_per_lb") || 1.75),
          surcharge: Number(formData.get("zone_international_surcharge") || 4),
          min_weight_lb: 0,
          max_weight_lb: Number(formData.get("zone_international_max") || 70),
          zip_prefixes: [],
          is_active: formData.get("zone_international_enabled") === "on",
        },
      ],
    },
    updated_at: new Date().toISOString(),
  }, "ivoire_shipping");
  if (!saved) return { error: "Couldn’t save shipping rates. Schema may not be applied yet.", saved: false };
  revalidateFulfillment();
  return { saved: true };
}

export type IvoirePreviewState = {
  error?: string;
  amount?: number;
  explanation?: string;
  usedFallback?: boolean;
  usedDefaults?: boolean;
  blocked?: boolean;
  weight?: number;
  zoneName?: string | null;
};

export async function previewIvoireShipping(_prev: IvoirePreviewState | null, formData: FormData): Promise<IvoirePreviewState> {
  const { supabase } = await requireAdmin();
  const { data: settings } = await supabase.from("store_settings").select("*").eq("id", STORE_SETTINGS_ID).maybeSingle();
  const origin = originFromSettings(settings);
  const country = String(formData.get("preview_country") || "US");
  const zip = String(formData.get("preview_zip") || "");
  const qty = Math.max(1, Math.round(Number(formData.get("preview_qty") || 1)));
  const weight = Number(formData.get("preview_weight") || 0);
  const quote = estimateIvoireShipping({
    config: ivoireShippingConfigFromRow(settings as Record<string, unknown> | null),
    packages: [{ quantity: qty, ship_weight_lb: weight > 0 ? weight : null }],
    destinationCountry: country,
    destinationPostalCode: zip,
    originLabel: originIsComplete(origin) ? formatOriginLines(origin).slice(0, 2).join(", ") : null,
  });
  if (!quote) return { error: "Ivoire Shop shipping is disabled or has no cart to quote." };
  return {
    amount: quote.amount,
    explanation: quote.explanation,
    usedFallback: quote.usedFallback,
    usedDefaults: quote.usedDefaults,
    blocked: quote.blocked === true,
    weight: quote.billableWeightLb,
    zoneName: quote.zoneName,
  };
}

export type ShipmentActionState = {
  error?: string;
  saved?: boolean;
  corrected?: boolean;
  markedShipped?: boolean;
};

export async function saveOrderShipment(_prev: ShipmentActionState | null, formData: FormData): Promise<ShipmentActionState> {
  const { supabase } = await requireAdmin();
  const id = String(formData.get("id") ?? "").trim();
  const trackingRaw = String(formData.get("tracking_number") ?? "");
  const correction = String(formData.get("mode") ?? "") === "correction";
  if (!id) return { error: "Order is missing." };
  const { data: order, error: readError } = await supabase
    .from("orders")
    .select("id, status, fulfillment_method, fulfillment_provider, tracking_number, shipped_at, is_demo, payment_provider, payment_status")
    .eq("id", id)
    .maybeSingle();
  if (readError || !order) return { error: "That order could not be found." };
  if (!isCarrierOrder(order.fulfillment_provider)) {
    return { error: "Carrier tracking is only for UPS and USPS orders." };
  }
  const checked = validateCarrierTracking(order.fulfillment_provider || "", trackingRaw);
  if (!checked.ok) return { error: checked.error };
  const postageRaw = String(formData.get("postage_cost") ?? "").trim();
  const postageParsed = postageRaw ? parseAdminMoney(postageRaw) : { ok: true as const, amount: null };
  if (postageRaw && !postageParsed.ok) return { error: "Enter a valid actual postage amount, or leave it blank." };
  const postage = postageParsed.ok ? postageParsed.amount : null;
  const alreadyShipped = order.status === "shipped" || Boolean(order.shipped_at);
  const hadTracking = Boolean(order.tracking_number);
  const trackingChanged = normalizeStoredTracking(order.tracking_number) !== checked.tracking;
  if (alreadyShipped && !correction && hadTracking && trackingChanged) {
    return { error: "Use Edit Tracking to change a saved tracking number." };
  }
  if (!alreadyShipped && ["delivered", "cancelled"].includes(order.status)) {
    return { error: "This order cannot be marked shipped." };
  }
  const shippedAt = alreadyShipped
    ? order.shipped_at
    : parseShipmentDate(String(formData.get("shipped_at") ?? ""));
  const patch: Record<string, unknown> = { tracking_number: checked.tracking };
  const demo = order.is_demo || order.payment_provider === "demo" || order.payment_status === "demo";
  if (postage != null && !demo) patch.postage_cost = postage;
  if (!alreadyShipped) {
    patch.status = "shipped";
    patch.shipped_at = shippedAt;
  }
  const { data: changed, error } = await supabase.from("orders").update(patch).eq("id", id).select("id").maybeSingle();
  if (error || !changed) return { error: "Shipping details could not be saved. Try again." };
  await supabase.from("order_carrier_events").insert({
    order_id: id,
    carrier: order.fulfillment_provider,
    tracking_number: checked.tracking,
    event_code: correction && hadTracking ? "tracking_corrected" : "label_accepted",
    source: "admin",
    occurred_at: shippedAt,
  });
  if (!alreadyShipped) {
    const emailSent = demo ? false : await notifyFulfillmentEmail(supabase, id, "shipped");
    await recordFulfillmentNotification(supabase, id, "shipped", Boolean(emailSent), order.fulfillment_provider);
  } else if (!hadTracking) {
    await recordCustomerNotification(supabase, id, "tracking_added");
  } else if (trackingChanged) {
    await recordCustomerNotification(supabase, id, "tracking_updated");
  }
  revalidateFulfillment(id);
  return {
    saved: true,
    corrected: Boolean(correction && hadTracking && trackingChanged),
    markedShipped: !alreadyShipped,
  };
}

function normalizeStoredTracking(value?: string | null) {
  return String(value ?? "").toUpperCase().replace(/[\s-]/g, "");
}

function parseShipmentDate(raw: string) {
  const value = raw.trim();
  if (!value) return new Date().toISOString();
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return new Date().toISOString();
  return parsed.toISOString();
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
  const shippo = shippoCredentials();
  const accounts = shippo.configured ? await listShippoCarrierAccounts() : { ok: false, ups: 0, usps: 0, accountIds: [] as string[] };
  await supabase.from("delivery_provider_health").upsert({
    provider: "shippo",
    status: !shippo.configured ? "not_configured" : accounts.ok ? "connected" : "error",
    last_check_at: new Date().toISOString(),
    last_error: accounts.ok ? null : "Shippo carrier account check failed",
    updated_at: new Date().toISOString(),
  });
  for (const provider of ["ups", "usps"] as const) {
    const connected = accounts.ok && accounts[provider] > 0;
    await supabase.from("delivery_provider_health").upsert({
      provider,
      status: connected ? "connected" : "manual",
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
