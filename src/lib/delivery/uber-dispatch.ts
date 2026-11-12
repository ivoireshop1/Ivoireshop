import { createAdminClient } from "@/src/lib/supabase/admin";
import { uberDirectCredentials, uberDirectEnvironment, uberDispatchAllowed } from "./credentials";
import { formatUberAddress, createUberDelivery, cancelUberDelivery, getUberDelivery } from "./providers/uber-direct";
import { paidUberBookingBlocker, shouldApplyUberStatus, uberIdempotencyKey } from "./uber-status";

export { paidUberBookingBlocker, uberIdempotencyKey };

type OrderRow = {
  id: string;
  order_number?: string | null;
  payment_status?: string | null;
  fulfillment_provider?: string | null;
  fulfillment_method?: string | null;
  shipping_cost?: number | string | null;
  customer_name?: string | null;
  customer_phone?: string | null;
  is_demo?: boolean | null;
  shipping_address?: Record<string, string | null> | null;
  delivery_snapshot?: Record<string, unknown> | null;
};

export async function bookPaidUberDelivery(orderId: string, input: { fetchImpl?: typeof fetch; env?: NodeJS.ProcessEnv } = {}) {
  const admin = createAdminClient();
  if (!admin) return { ok: false as const, error: "The server cannot record an Uber delivery." };
  const { data: order } = await admin.from("orders").select("id, order_number, payment_status, fulfillment_provider, fulfillment_method, shipping_cost, customer_name, customer_phone, is_demo, shipping_address, delivery_snapshot").eq("id", orderId).maybeSingle();
  const row = order as OrderRow | null;
  if (!row || row.fulfillment_provider !== "uber" || row.fulfillment_method !== "delivery") return { ok: false as const, skipped: true as const };
  const env = input.env ?? process.env;
  const { data: settings } = await admin.from("store_settings").select("origin_name, origin_address_line_1, origin_address_line_2, origin_city, origin_state, origin_postal_code, origin_country, origin_phone, uber_direct_production_dispatch").eq("id", "default").maybeSingle() as { data: {
    origin_name?: string | null;
    origin_address_line_1?: string | null;
    origin_address_line_2?: string | null;
    origin_city?: string | null;
    origin_state?: string | null;
    origin_postal_code?: string | null;
    origin_country?: string | null;
    origin_phone?: string | null;
    uber_direct_production_dispatch?: boolean | null;
  } | null };
  if (!canBook(settings, env)) {
    await remember(admin, row, { status: "blocked", last_error: "Uber courier dispatch is off." });
    return { ok: false as const, error: "Uber courier dispatch is off." };
  }
  const existing = await loadDelivery(admin, row.id);
  if (existing?.delivery_id) return { ok: true as const, duplicate: true as const, deliveryId: existing.delivery_id };
  const snapshot = row.delivery_snapshot ?? {};
  const quoteId = String(snapshot.uber_quote_id ?? "");
  const feeCents = Number(snapshot.uber_fee_cents);
  const markupCents = Number(snapshot.uber_markup_cents ?? 0);
  const blocker = paidUberBookingBlocker({
    paymentStatus: String(row.payment_status ?? ""),
    isDemo: Boolean(row.is_demo),
    dispatchAllowed: true,
    quoteId,
    quoteExpiresAt: snapshot.uber_expires_at ? String(snapshot.uber_expires_at) : null,
    now: Date.now(),
    feeCents,
    markupCents,
    shippingCost: Number(row.shipping_cost ?? 0),
  });
  if (blocker) return fail(admin, row, blocker);
  const pickup = formatUberAddress({
    address_line_1: settings?.origin_address_line_1,
    address_line_2: settings?.origin_address_line_2,
    city: settings?.origin_city,
    state: settings?.origin_state,
    postal_code: settings?.origin_postal_code,
    country: settings?.origin_country,
  });
  const dropoff = formatUberAddress(row.shipping_address ?? {});
  const pickupPhone = String(settings?.origin_phone ?? "").trim();
  const dropoffPhone = String(row.customer_phone ?? row.shipping_address?.phone ?? "").trim();
  if (!pickup || !dropoff || !pickupPhone || !dropoffPhone) return fail(admin, row, "The pickup or delivery phone and address must be complete before a courier is booked.");
  const key = uberIdempotencyKey(row.id);
  const { error: insertError } = await admin.from("uber_deliveries").insert({
    order_id: row.id,
    idempotency_key: key,
    environment: uberDirectEnvironment(env),
    quote_id: quoteId,
    status: "booking",
    fee_cents: feeCents,
    markup_cents: markupCents,
    currency: "USD",
  });
  if (insertError) {
    const again = await loadDelivery(admin, row.id);
    if (again?.delivery_id) return { ok: true as const, duplicate: true as const, deliveryId: again.delivery_id };
    if (again?.status === "booking") return { ok: false as const, error: "A courier booking is already in progress." };
  }
  const created = await createUberDelivery({
    quoteId,
    idempotencyKey: key,
    pickupName: String(settings?.origin_name ?? "Ivoire Shop"),
    pickupPhone,
    pickup,
    dropoffName: String(row.customer_name ?? "Customer"),
    dropoffPhone,
    dropoff,
    manifestReference: String(row.order_number ?? row.id),
    manifestItems: [{ name: "Ivoire Shop order", quantity: 1 }],
    fetchImpl: input.fetchImpl,
    env,
  });
  if (!created.ok) return fail(admin, row, created.error);
  await admin.from("uber_deliveries").update({
    delivery_id: created.delivery.id,
    status: created.delivery.status || "pending",
    tracking_url: created.delivery.trackingUrl,
    courier_name: created.delivery.courierName,
    courier_phone: created.delivery.courierPhone,
    courier_vehicle: created.delivery.courierVehicle,
    last_error: null,
    updated_at: new Date().toISOString(),
  }).eq("order_id", row.id);
  await admin.from("orders").update({
    delivery_snapshot: {
      ...snapshot,
      uber_delivery_id: created.delivery.id,
      tracking_url: created.delivery.trackingUrl,
      uber_status: created.delivery.status,
    },
  }).eq("id", row.id);
  return { ok: true as const, deliveryId: created.delivery.id };
}

export async function applyUberWebhook(input: { rawBody: string; payload: Record<string, unknown> }) {
  const admin = createAdminClient();
  if (!admin) return { ok: false as const, status: 503 };
  const data = input.payload.data && typeof input.payload.data === "object" ? input.payload.data as Record<string, unknown> : input.payload;
  const deliveryId = String(data.delivery_id ?? data.id ?? input.payload.delivery_id ?? "");
  const kind = String(input.payload.kind ?? input.payload.event_type ?? "event.delivery_status");
  const eventKey = String(input.payload.id ?? input.payload.event_id ?? "") || `body:${Buffer.from(input.rawBody).toString("base64url").slice(0, 80)}`;
  const { error } = await admin.from("uber_webhook_events").insert({ event_key: eventKey, event_kind: kind, delivery_id: deliveryId || null });
  if (error) return { ok: true as const, duplicate: true as const };
  if (!deliveryId) return { ok: true as const, ignored: true as const };
  const { data: current } = await admin.from("uber_deliveries").select("order_id, status").eq("delivery_id", deliveryId).maybeSingle();
  if (!current) return { ok: true as const, ignored: true as const };
  const incoming = String(data.status ?? current.status ?? "");
  if (kind !== "event.courier_update" && !shouldApplyUberStatus(current.status, incoming)) return { ok: true as const, stale: true as const };
  const courier = data.courier && typeof data.courier === "object" ? data.courier as Record<string, unknown> : null;
  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (kind !== "event.courier_update" && incoming) patch.status = incoming === "canceled" ? "cancelled" : incoming;
  if (data.tracking_url) patch.tracking_url = String(data.tracking_url);
  if (courier?.name) patch.courier_name = String(courier.name);
  if (courier?.phone_number) patch.courier_phone = String(courier.phone_number);
  if (courier?.vehicle_type) patch.courier_vehicle = String(courier.vehicle_type);
  if (kind.includes("refund")) patch.last_error = "Uber reported a refund event.";
  await admin.from("uber_deliveries").update(patch).eq("delivery_id", deliveryId);
  return { ok: true as const };
}

export async function refreshUberDeliveryRecord(orderId: string, input: { fetchImpl?: typeof fetch; env?: NodeJS.ProcessEnv } = {}) {
  const admin = createAdminClient();
  if (!admin) return { ok: false as const, error: "The server cannot read Uber deliveries." };
  const current = await loadDelivery(admin, orderId);
  if (!current?.delivery_id) return { ok: true as const, delivery: current };
  const live = await getUberDelivery(current.delivery_id, input);
  if (!live.ok) return { ok: false as const, error: live.error };
  if (shouldApplyUberStatus(current.status, live.delivery.status)) {
    await admin.from("uber_deliveries").update({
      status: live.delivery.status,
      tracking_url: live.delivery.trackingUrl,
      courier_name: live.delivery.courierName,
      courier_phone: live.delivery.courierPhone,
      courier_vehicle: live.delivery.courierVehicle,
      updated_at: new Date().toISOString(),
    }).eq("order_id", orderId);
  }
  return { ok: true as const, delivery: live.delivery };
}

export async function cancelUberDeliveryForOrder(orderId: string, input: { fetchImpl?: typeof fetch; env?: NodeJS.ProcessEnv } = {}) {
  const admin = createAdminClient();
  if (!admin) return { ok: false as const, error: "The server cannot cancel an Uber delivery." };
  const current = await loadDelivery(admin, orderId);
  if (!current?.delivery_id) return { ok: false as const, error: "This order has no Uber delivery to cancel." };
  const cancelled = await cancelUberDelivery(current.delivery_id, input);
  if (!cancelled.ok) {
    await admin.from("uber_deliveries").update({ last_error: cancelled.error, updated_at: new Date().toISOString() }).eq("order_id", orderId);
    return cancelled;
  }
  await admin.from("uber_deliveries").update({ status: "cancelled", updated_at: new Date().toISOString(), last_error: null }).eq("order_id", orderId);
  return { ok: true as const };
}

function canBook(settings: { uber_direct_production_dispatch?: boolean | null } | null, env: NodeJS.ProcessEnv) {
  if (!uberDispatchAllowed(env)) return false;
  if (uberDirectEnvironment(env) === "production" && settings?.uber_direct_production_dispatch !== true) return false;
  return uberDirectCredentials(env).configured;
}

async function loadDelivery(admin: NonNullable<ReturnType<typeof createAdminClient>>, orderId: string) {
  const { data } = await admin.from("uber_deliveries").select("order_id, delivery_id, status, tracking_url").eq("order_id", orderId).maybeSingle();
  return data as { order_id: string; delivery_id: string | null; status: string | null; tracking_url: string | null } | null;
}

async function remember(admin: NonNullable<ReturnType<typeof createAdminClient>>, order: OrderRow, patch: { status: string; last_error: string }) {
  await admin.from("uber_deliveries").upsert({
    order_id: order.id,
    idempotency_key: uberIdempotencyKey(order.id),
    environment: uberDirectEnvironment(),
    status: patch.status,
    last_error: patch.last_error,
    updated_at: new Date().toISOString(),
  }, { onConflict: "order_id" });
}

async function fail(admin: NonNullable<ReturnType<typeof createAdminClient>>, order: OrderRow, error: string) {
  await remember(admin, order, { status: "failed", last_error: error });
  return { ok: false as const, error };
}
