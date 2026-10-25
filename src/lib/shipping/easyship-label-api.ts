import { buildEasyshipRateRequest } from "./easyship.ts";

type FetchLike = (url: string, init?: RequestInit) => Promise<Response>;

export function buildEasyshipShipmentBody(input: {
  rateRequest: ReturnType<typeof buildEasyshipRateRequest>;
  courierServiceId: string;
  destinationEmail?: string | null;
}) {
  const origin = { ...input.rateRequest.origin_address };
  const destination = { ...input.rateRequest.destination_address };
  const email = String(input.destinationEmail ?? "").trim();
  if (email) destination.contact_email = email;
  return {
    origin_address: origin,
    destination_address: destination,
    shipping_settings: {
      ...input.rateRequest.shipping_settings,
      buy_label: false,
      buy_label_synchronous: false,
    },
    calculate_tax_and_duties: false,
    parcels: input.rateRequest.parcels,
    courier_settings: {
      courier_service_id: input.courierServiceId,
      allow_fallback: false,
    },
  };
}

export type PurchasedUpsLabel = {
  easyshipShipmentId: string;
  labelState: string | null;
  serviceName: string | null;
  courierServiceId: string | null;
  umbrella: string | null;
  trackingNumber: string | null;
  trackingUrl: string | null;
  labelUrl: string | null;
  labelDocumentId: string | null;
  labelFormat: string | null;
  labelPdfBase64: string | null;
  labelCost: number | null;
  currency: string | null;
};

function upsUmbrella(value: string) {
  const token = value.trim().toLowerCase();
  if (!token || token.includes("usps")) return false;
  return token === "ups" || token.includes("ups");
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" ? value as Record<string, unknown> : null;
}

export function parseEasyshipLabelResponse(body: unknown): PurchasedUpsLabel | null {
  const root = asRecord(body);
  const shipment = asRecord(root?.shipment) ?? root;
  if (!shipment) return null;
  const courier = asRecord(shipment.courier_service);
  const rates = Array.isArray(shipment.rates) ? shipment.rates : [];
  const firstRate = asRecord(rates[0]);
  const trackings = Array.isArray(shipment.trackings) ? shipment.trackings : [];
  const tracking = asRecord(trackings[0]);
  const documents = Array.isArray(shipment.shipping_documents) ? shipment.shipping_documents : [];
  const label = documents.map(asRecord).find((row) => String(row?.category ?? "").toLowerCase() === "label") ?? null;
  const encoded = Array.isArray(label?.base64_encoded_strings)
    ? label.base64_encoded_strings.map((part) => String(part ?? "")).join("")
    : "";
  const amount = Number(firstRate?.total_charge);
  const id = String(shipment.easyship_shipment_id ?? "").trim();
  if (!id) return null;
  return {
    easyshipShipmentId: id,
    labelState: shipment.label_state ? String(shipment.label_state) : null,
    serviceName: courier?.name ? String(courier.name) : null,
    courierServiceId: courier?.id ? String(courier.id) : null,
    umbrella: courier?.umbrella_name ? String(courier.umbrella_name) : null,
    trackingNumber: tracking?.tracking_number ? String(tracking.tracking_number) : null,
    trackingUrl: shipment.tracking_page_url ? String(shipment.tracking_page_url) : null,
    labelUrl: label?.url ? String(label.url) : null,
    labelDocumentId: label?.id ? String(label.id) : null,
    labelFormat: label?.format ? String(label.format) : null,
    labelPdfBase64: encoded || null,
    labelCost: Number.isFinite(amount) ? amount : null,
    currency: firstRate?.currency ? String(firstRate.currency) : null,
  };
}

export async function executeEasyshipLabelPurchase(input: {
  fetchImpl: FetchLike;
  host: string;
  key: string;
  idempotencyKey: string;
  shipmentBody: unknown;
  courierServiceId: string;
  existingShipmentId?: string | null;
}) {
  if (!input.key || !input.host) {
    return { ok: false as const, error: "Easyship is not configured.", shipmentId: null as string | null };
  }
  const headers = {
    Authorization: `Bearer ${input.key}`,
    "Content-Type": "application/json",
  };
  let shipmentId = input.existingShipmentId?.trim() || "";
  if (!shipmentId) {
    const created = await input.fetchImpl(`${input.host}/2024-09/shipments`, {
      method: "POST",
      headers: { ...headers, "Idempotency-Key": input.idempotencyKey },
      body: JSON.stringify(input.shipmentBody),
    });
    const createdBody = await created.json().catch(() => null);
    const parsed = parseEasyshipLabelResponse(createdBody);
    if (!created.ok || !parsed) {
      return { ok: false as const, error: "Easyship did not create the UPS shipment. No label was bought.", shipmentId: parsed?.easyshipShipmentId ?? null };
    }
    shipmentId = parsed.easyshipShipmentId;
  }
  const bought = await input.fetchImpl(`${input.host}/2024-09/shipments/${encodeURIComponent(shipmentId)}/label`, {
    method: "POST",
    headers: { ...headers, "Idempotency-Key": `${input.idempotencyKey}:label` },
    body: JSON.stringify({ courier_service_id: input.courierServiceId }),
  });
  const boughtBody = await bought.json().catch(() => null);
  const label = parseEasyshipLabelResponse(boughtBody);
  if (!bought.ok || !label) {
    return { ok: false as const, error: "Easyship did not return a UPS label. The purchase was not recorded as complete.", shipmentId };
  }
  if (label.umbrella && !upsUmbrella(label.umbrella)) {
    return { ok: false as const, error: "Easyship returned a non-UPS label. It was not saved as the order label.", shipmentId };
  }
  if (label.courierServiceId && label.courierServiceId !== input.courierServiceId) {
    return { ok: false as const, error: "Easyship returned a different courier service than the one reviewed.", shipmentId };
  }
  return { ok: true as const, label: { ...label, easyshipShipmentId: label.easyshipShipmentId || shipmentId }, shipmentId };
}
