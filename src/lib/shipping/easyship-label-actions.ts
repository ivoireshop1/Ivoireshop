"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/src/lib/auth/guards";
import { originFromSettings } from "@/src/lib/delivery/origin";
import { trackingUrl, validateCarrierTracking } from "@/src/lib/delivery/tracking";
import { recordCustomerNotification } from "@/src/lib/notifications/record";
import { STORE_SETTINGS_ID } from "@/src/lib/store/constants";
import { loadShippingPackages } from "./package-store";
import { easyshipCredentials, quoteEasyshipRates, type EasyshipRate } from "./easyship";
import { executeEasyshipLabelPurchase, buildEasyshipShipmentBody } from "./easyship-label-api";
import {
  decideEasyshipLabelPurchase,
  easyshipLabelPurchasesEnabled,
  labelPdfReady,
  prepareOrderLabelQuote,
  trackingNotificationAfterSave,
  upsLabelEligibility,
  type StoredUpsLabel,
  type UpsLabelOrder,
  type UpsLabelRate,
} from "./easyship-labels";

export type UpsLabelActionState = {
  error?: string;
  reviewed?: boolean;
  purchased?: boolean;
  duplicate?: boolean;
  held?: boolean;
  notification?: "tracking_added" | null;
  customerShipping?: number | null;
  labelCost?: number | null;
  difference?: number | null;
  service?: string | null;
  courierServiceId?: string | null;
  estimatedDays?: number | null;
  shipmentCharge?: number | null;
  fuelSurcharge?: number | null;
  chargeCoversKnownParts?: boolean;
  trackingNumber?: string | null;
  labelReady?: boolean;
  purchasesEnabled?: boolean;
};

const PRODUCT_FIELDS = "id, name, description, price, selling_method, selling_unit, unit_increment, min_sell_qty, max_sell_qty, package_weight_lb, ship_weight_lb, ship_length_in, ship_width_in, ship_height_in, item_weight_lb, shipping_package_id, weight_oz, packaging_weight_oz, weight_source, dims";

function money(value: unknown) {
  const amount = Number(value);
  return Number.isFinite(amount) ? amount : null;
}

function snapshotId(snapshot: unknown) {
  if (!snapshot || typeof snapshot !== "object") return null;
  const id = (snapshot as { easyship_rate_id?: unknown }).easyship_rate_id;
  return typeof id === "string" && id.trim() ? id.trim() : null;
}

function addressOf(order: { shipping_address?: unknown; customer_name?: string | null; customer_phone?: string | null; customer_email?: string | null }) {
  const row = order.shipping_address && typeof order.shipping_address === "object" ? order.shipping_address as Record<string, unknown> : {};
  return {
    name: String(row.name ?? order.customer_name ?? ""),
    phone: String(row.phone ?? order.customer_phone ?? ""),
    email: String(order.customer_email ?? ""),
    address_line_1: String(row.address_line_1 ?? ""),
    address_line_2: String(row.address_line_2 ?? ""),
    city: String(row.city ?? ""),
    state: String(row.state ?? ""),
    postal_code: String(row.postal_code ?? ""),
    country: String(row.country ?? ""),
  };
}

function toRates(rates: EasyshipRate[]): UpsLabelRate[] {
  return rates.map((rate) => ({
    courierServiceId: rate.objectId,
    provider: rate.provider,
    service: rate.service,
    amount: rate.amount,
    currency: rate.currency,
    estimatedDays: rate.estimatedDays,
    shipmentCharge: rate.shipmentCharge,
    fuelSurcharge: rate.fuelSurcharge,
  }));
}

function storedFrom(row: Record<string, unknown> | null): StoredUpsLabel | null {
  if (!row) return null;
  const status = String(row.status ?? "");
  if (status !== "purchasing" && status !== "purchased" && status !== "failed") return null;
  return {
    id: String(row.id),
    status,
    idempotencyKey: String(row.idempotency_key ?? ""),
    courierServiceId: row.courier_service_id ? String(row.courier_service_id) : null,
    labelCost: money(row.label_cost),
    easyshipShipmentId: row.easyship_shipment_id ? String(row.easyship_shipment_id) : null,
    trackingNumber: row.tracking_number ? String(row.tracking_number) : null,
    errorMessage: row.error_message ? String(row.error_message) : null,
  };
}

function stateFromDecision(decision: ReturnType<typeof decideEasyshipLabelPurchase>, purchasesEnabled: boolean): UpsLabelActionState {
  if (decision.action === "ineligible") return { error: decision.error, purchasesEnabled };
  if (decision.action === "duplicate") {
    return {
      duplicate: true,
      purchased: true,
      purchasesEnabled,
      error: "This order already has a purchased UPS label. No second label was bought.",
      labelCost: decision.label.labelCost,
      trackingNumber: decision.label.trackingNumber,
      courierServiceId: decision.label.courierServiceId,
    };
  }
  const rate = decision.rate;
  const base: UpsLabelActionState = {
    reviewed: true,
    purchasesEnabled,
    customerShipping: decision.comparison.customerShipping,
    labelCost: decision.comparison.labelCost,
    difference: decision.comparison.difference,
    service: rate.service,
    courierServiceId: rate.courierServiceId,
    estimatedDays: rate.estimatedDays,
    shipmentCharge: rate.shipmentCharge,
    fuelSurcharge: rate.fuelSurcharge,
    chargeCoversKnownParts: true,
  };
  if (!("error" in decision) || decision.action === "show") return base;
  return { ...base, error: decision.error, held: decision.action === "hold" || decision.action === "blocked" };
}

async function loadPurchaseContext(orderId: string) {
  const { supabase, user } = await requireAdmin();
  const [{ data: order }, { data: items }, { data: settings }, purchases, packages] = await Promise.all([
    supabase.from("orders").select("id, payment_status, is_demo, status, fulfillment_method, fulfillment_provider, fulfillment_service, shipping_cost, shipping_address, customer_name, customer_email, customer_phone, tracking_number, delivery_snapshot, user_id").eq("id", orderId).maybeSingle(),
    supabase.from("order_items").select(`product_id, product_name, product_price, quantity, products(${PRODUCT_FIELDS})`).eq("order_id", orderId),
    supabase.from("store_settings").select("*").eq("id", STORE_SETTINGS_ID).maybeSingle(),
    supabase.from("easyship_label_purchases").select("id, status, idempotency_key, courier_service_id, label_cost, easyship_shipment_id, tracking_number, error_message, created_at").eq("order_id", orderId).order("created_at", { ascending: false }),
    loadShippingPackages(supabase),
  ]);
  return { supabase, user, order, items: items ?? [], settings, purchases: purchases.data ?? [], purchaseError: purchases.error, packages };
}

function orderForDecision(order: NonNullable<Awaited<ReturnType<typeof loadPurchaseContext>>["order"]>): UpsLabelOrder {
  return {
    id: order.id,
    paymentStatus: String(order.payment_status ?? ""),
    isDemo: Boolean(order.is_demo),
    status: String(order.status ?? ""),
    fulfillmentMethod: String(order.fulfillment_method ?? ""),
    provider: String(order.fulfillment_provider ?? ""),
    service: order.fulfillment_service ? String(order.fulfillment_service) : null,
    shippingCost: money(order.shipping_cost),
    courierServiceId: snapshotId(order.delivery_snapshot),
  };
}

async function quoteOrder(context: Awaited<ReturnType<typeof loadPurchaseContext>>) {
  if (!context.order) return { ok: false as const, error: "That order could not be found." };
  const eligible = upsLabelEligibility(orderForDecision(context.order));
  if (!eligible.ok) return { ok: false as const, error: eligible.error };
  const products = context.items.map((item) => {
    const product = Array.isArray(item.products) ? item.products[0] : item.products;
    const row = product && typeof product === "object" ? product as Record<string, unknown> : {};
    return {
      ...row,
      name: String(row.name ?? item.product_name ?? ""),
      description: String(row.description ?? item.product_name ?? ""),
      price: row.price ?? item.product_price,
      quantity: Number(item.quantity ?? 1),
    };
  });
  const prepared = prepareOrderLabelQuote({
    origin: originFromSettings(context.settings),
    destination: addressOf(context.order),
    products,
    packages: context.packages,
    defaultPackageId: typeof context.settings?.default_shipping_package_id === "string" ? context.settings.default_shipping_package_id : null,
  });
  if (!prepared.ok) return prepared;
  const quoted = await quoteEasyshipRates({
    origin: originFromSettings(context.settings),
    destination: addressOf(context.order),
    parcels: prepared.parcels,
    products,
  });
  if (!quoted.ok) return { ok: false as const, error: quoted.error };
  return { ok: true as const, prepared, rates: toRates(quoted.rates) };
}

export async function reviewUpsLabel(_prev: UpsLabelActionState | null, formData: FormData): Promise<UpsLabelActionState> {
  const orderId = String(formData.get("order_id") ?? "").trim();
  if (!orderId) return { error: "Order is missing." };
  const context = await loadPurchaseContext(orderId);
  if (context.purchaseError) return { error: "UPS label history is not available yet. Apply the easyship label migration before buying postage." };
  if (!context.order) return { error: "That order could not be found." };
  const existingRows = context.purchases.map((row) => storedFrom(row)).filter((row): row is StoredUpsLabel => Boolean(row));
  const already = existingRows.find((row) => row.status === "purchased");
  if (already) {
    return { duplicate: true, purchased: true, purchasesEnabled: easyshipLabelPurchasesEnabled(), labelCost: already.labelCost, trackingNumber: already.trackingNumber, error: "This order already has a purchased UPS label. No second label was bought." };
  }
  const quoted = await quoteOrder(context);
  if (!quoted.ok) return { error: quoted.error, purchasesEnabled: easyshipLabelPurchasesEnabled() };
  const rows = existingRows;
  const decision = decideEasyshipLabelPurchase({
    order: orderForDecision(context.order),
    rates: quoted.rates,
    reviewedAmount: null,
    reviewedServiceId: null,
    confirm: "",
    purchasesEnabled: easyshipLabelPurchasesEnabled(),
    existing: rows.find((row) => row.status === "purchased" || row.status === "purchasing") ?? null,
    failedAttempts: rows.filter((row) => row.status === "failed").length,
  });
  return stateFromDecision(decision, easyshipLabelPurchasesEnabled());
}

export async function purchaseUpsLabel(_prev: UpsLabelActionState | null, formData: FormData): Promise<UpsLabelActionState> {
  const orderId = String(formData.get("order_id") ?? "").trim();
  const confirm = String(formData.get("confirm") ?? "");
  const reviewedAmount = money(formData.get("reviewed_amount"));
  const reviewedServiceId = String(formData.get("reviewed_service_id") ?? "").trim() || null;
  const retryMode = String(formData.get("retry_mode") ?? "") === "new" ? "new" as const : "same" as const;
  if (!orderId) return { error: "Order is missing." };
  const context = await loadPurchaseContext(orderId);
  if (context.purchaseError) return { error: "UPS label history is not available yet. Apply the easyship label migration before buying postage." };
  if (!context.order) return { error: "That order could not be found." };
  const rows = context.purchases.map((row) => storedFrom(row)).filter((row): row is StoredUpsLabel => Boolean(row));
  const already = rows.find((row) => row.status === "purchased");
  if (already) {
    const saved = await persistTracking(context, already);
    return {
      duplicate: true,
      purchased: true,
      purchasesEnabled: easyshipLabelPurchasesEnabled(),
      labelCost: already.labelCost,
      trackingNumber: saved.trackingNumber ?? already.trackingNumber,
      notification: saved.notification,
      error: saved.error ?? "This order already has a purchased UPS label. No second label was bought.",
    };
  }
  const quoted = await quoteOrder(context);
  if (!quoted.ok) return { error: quoted.error, purchasesEnabled: easyshipLabelPurchasesEnabled() };
  const active = rows.find((row) => row.status === "purchasing") ?? null;
  const decision = decideEasyshipLabelPurchase({
    order: orderForDecision(context.order),
    rates: quoted.rates,
    reviewedAmount,
    reviewedServiceId,
    confirm,
    purchasesEnabled: easyshipLabelPurchasesEnabled(),
    existing: active ?? rows.find((row) => row.status === "failed") ?? null,
    failedAttempts: rows.filter((row) => row.status === "failed").length,
    retryMode,
  });
  if (decision.action === "duplicate") {
    const saved = await persistTracking(context, decision.label);
    return {
      ...stateFromDecision(decision, easyshipLabelPurchasesEnabled()),
      notification: saved.notification,
      trackingNumber: saved.trackingNumber ?? decision.label.trackingNumber,
      labelReady: rows.some((row) => row.status === "purchased"),
      error: saved.error,
    };
  }
  if (decision.action !== "buy" && decision.action !== "resume") {
    return stateFromDecision(decision, easyshipLabelPurchasesEnabled());
  }

  let purchaseId = active?.status === "purchasing" ? active.id : "";
  let idempotencyKey = decision.idempotencyKey;
  let existingShipmentId = decision.existingShipmentId;
  if (decision.action === "buy") {
    const inserted = await context.supabase.from("easyship_label_purchases").insert({
      order_id: orderId,
      idempotency_key: decision.idempotencyKey,
      status: "purchasing",
      carrier: "ups",
      service_name: decision.rate.service,
      courier_service_id: decision.rate.courierServiceId,
      customer_shipping_cost: decision.comparison.customerShipping,
      label_cost: decision.rate.amount,
      currency: "USD",
      confirmed_by: context.user.id,
    }).select("id").maybeSingle();
    if (inserted.error || !inserted.data) {
      const again = await loadPurchaseContext(orderId);
      const current = (again.purchases ?? []).map((row) => storedFrom(row)).find((row) => row?.status === "purchased" || row?.status === "purchasing");
      if (current?.status === "purchased") {
        return { duplicate: true, purchased: true, error: "This order already has a purchased UPS label. No second label was bought.", purchasesEnabled: easyshipLabelPurchasesEnabled() };
      }
      if (current?.status === "purchasing") {
        purchaseId = current.id;
        idempotencyKey = current.idempotencyKey;
        existingShipmentId = current.easyshipShipmentId;
      } else {
        return { error: "The label purchase could not be reserved. Nothing was sent to Easyship.", purchasesEnabled: easyshipLabelPurchasesEnabled() };
      }
    } else {
      purchaseId = inserted.data.id;
    }
  }

  const creds = easyshipCredentials();
  const bought = await executeEasyshipLabelPurchase({
    fetchImpl: fetch,
    host: creds.host,
    key: creds.key,
    idempotencyKey,
    shipmentBody: buildEasyshipShipmentBody({
      rateRequest: quoted.prepared.request,
      courierServiceId: decision.rate.courierServiceId,
      destinationEmail: quoted.prepared.destinationEmail,
    }),
    courierServiceId: decision.rate.courierServiceId,
    existingShipmentId,
  });
  if (!bought.ok) {
    await context.supabase.from("easyship_label_purchases").update({
      status: "purchasing",
      easyship_shipment_id: bought.shipmentId,
      error_message: bought.error,
      updated_at: new Date().toISOString(),
    }).eq("id", purchaseId);
    revalidatePath(`/admin/orders/${orderId}`);
    return {
      ...stateFromDecision({ action: "hold", error: bought.error, rate: decision.rate, comparison: decision.comparison }, easyshipLabelPurchasesEnabled()),
      held: true,
    };
  }

  const tracking = bought.label.trackingNumber ? validateCarrierTracking("ups", bought.label.trackingNumber) : null;
  const pdf = labelPdfReady(bought.label.labelPdfBase64) ? bought.label.labelPdfBase64 : null;
  const labelCost = bought.label.labelCost ?? decision.rate.amount;
  const localLabelUrl = `/api/admin/orders/${orderId}/easyship-label`;
  const savedPurchase = await context.supabase.from("easyship_label_purchases").update({
    status: "purchased",
    service_name: bought.label.serviceName || decision.rate.service,
    courier_service_id: decision.rate.courierServiceId,
    label_cost: labelCost,
    easyship_shipment_id: bought.label.easyshipShipmentId,
    label_document_id: bought.label.labelDocumentId,
    label_state: bought.label.labelState,
    tracking_number: tracking && tracking.ok ? tracking.tracking : null,
    tracking_url: tracking && tracking.ok ? (bought.label.trackingUrl || trackingUrl("ups", tracking.tracking)) : bought.label.trackingUrl,
    label_url: bought.label.labelUrl || (pdf ? localLabelUrl : null),
    label_format: bought.label.labelFormat,
    label_pdf_base64: pdf,
    label_ready: Boolean(pdf),
    error_message: tracking && !tracking.ok ? "Label purchased. Tracking was not written because it did not match a UPS number." : null,
    purchased_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }).eq("id", purchaseId).select("id, tracking_number").maybeSingle();
  if (savedPurchase.error || !savedPurchase.data) {
    return { error: "Easyship returned a label, but it could not be saved. Do not buy again until this purchase row is reviewed.", purchasesEnabled: easyshipLabelPurchasesEnabled() };
  }

  let notification: "tracking_added" | null = null;
  let trackingError: string | undefined;
  if (tracking && tracking.ok) {
    const persisted = await persistTracking(context, {
      id: purchaseId,
      status: "purchased",
      idempotencyKey,
      courierServiceId: decision.rate.courierServiceId,
      labelCost,
      easyshipShipmentId: bought.label.easyshipShipmentId,
      trackingNumber: tracking.tracking,
      errorMessage: null,
    });
    notification = persisted.notification;
    trackingError = persisted.error;
  }

  revalidatePath(`/admin/orders/${orderId}`);
  revalidatePath(`/account/orders/${orderId}`);
  return {
    purchased: true,
    purchasesEnabled: easyshipLabelPurchasesEnabled(),
    customerShipping: decision.comparison.customerShipping,
    labelCost,
    difference: decision.comparison.difference,
    service: bought.label.serviceName || decision.rate.service,
    courierServiceId: decision.rate.courierServiceId,
    trackingNumber: tracking && tracking.ok ? tracking.tracking : null,
    labelReady: Boolean(pdf),
    notification,
    error: trackingError || (tracking && !tracking.ok ? tracking.error : undefined),
  };
}

async function persistTracking(
  context: Awaited<ReturnType<typeof loadPurchaseContext>>,
  label: StoredUpsLabel,
) {
  if (!context.order || !label.trackingNumber) return { notification: null, trackingNumber: label.trackingNumber, error: undefined as string | undefined };
  const checked = validateCarrierTracking("ups", label.trackingNumber);
  if (!checked.ok) return { notification: null, trackingNumber: null, error: checked.error };
  const current = String(context.order.tracking_number ?? "").trim();
  if (current) return { notification: null, trackingNumber: current, error: undefined };
  const { data, error } = await context.supabase.from("orders").update({
    tracking_number: checked.tracking,
    postage_cost: label.labelCost,
  }).eq("id", context.order.id).is("tracking_number", null).select("id, tracking_number").maybeSingle();
  if (error || !data?.tracking_number) {
    return { notification: null, trackingNumber: null, error: "The label is saved. Tracking could not be written to the order, so the customer was not notified." };
  }
  await context.supabase.from("order_carrier_events").insert({
    order_id: context.order.id,
    carrier: "ups",
    tracking_number: checked.tracking,
    event_code: "label_purchased",
    source: "admin",
    occurred_at: new Date().toISOString(),
  });
  const notification = trackingNotificationAfterSave({ persisted: true, trackingNumber: checked.tracking });
  if (notification) await recordCustomerNotification(context.supabase, context.order.id, notification);
  return { notification, trackingNumber: checked.tracking, error: undefined };
}
