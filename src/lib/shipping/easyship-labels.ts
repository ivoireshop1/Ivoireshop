import { buildEasyshipRateRequest, easyshipQuoteItems, easyshipRateRequestIssues } from "./easyship.ts";
import { describePackedParcels, resolveCartParcel, type CartParcelProduct, type ShippingPackagePreset } from "./packages.ts";
import type { StoreOrigin } from "../delivery/origin.ts";

export const EASYSHIP_UPS_LABEL_CONFIRM = "buy-reviewed-ups-label";
export const EASYSHIP_LABEL_PURCHASE_FLAG = "founder-approved";

export function easyshipLabelPurchasesEnabled(env: NodeJS.ProcessEnv = process.env) {
  return String(env.EASYSHIP_LABEL_PURCHASES ?? "").trim() === EASYSHIP_LABEL_PURCHASE_FLAG;
}

export type UpsLabelOrder = {
  id: string;
  paymentStatus: string;
  isDemo: boolean;
  status: string;
  fulfillmentMethod: string;
  provider: string;
  service: string | null;
  shippingCost: number | null;
  courierServiceId: string | null;
};

export type UpsLabelRate = {
  courierServiceId: string;
  provider: "ups" | "usps";
  service: string;
  amount: number;
  currency: string;
  estimatedDays: number | null;
  shipmentCharge: number | null;
  fuelSurcharge: number | null;
};

export type StoredUpsLabel = {
  id: string;
  status: "purchasing" | "purchased" | "failed";
  idempotencyKey: string;
  courierServiceId: string | null;
  labelCost: number | null;
  easyshipShipmentId: string | null;
  trackingNumber: string | null;
  errorMessage: string | null;
};

export function upsLabelEligibility(order: UpsLabelOrder) {
  if (order.isDemo || order.paymentStatus === "demo") {
    return { ok: false as const, error: "Demonstration orders cannot buy postage." };
  }
  if (order.provider === "usps") {
    return { ok: false as const, error: "USPS labels are outside this UPS workflow." };
  }
  if (order.fulfillmentMethod === "local_pickup" || order.provider === "pickup") {
    return { ok: false as const, error: "Store Pickup does not use a UPS label." };
  }
  if (order.provider !== "ups" || order.fulfillmentMethod !== "delivery") {
    return { ok: false as const, error: "Buy Shipping Label is available for paid UPS delivery orders." };
  }
  if (order.paymentStatus !== "paid") {
    return { ok: false as const, error: "Collect payment before buying a UPS label." };
  }
  if (order.status === "cancelled") {
    return { ok: false as const, error: "Cancelled orders cannot buy a UPS label." };
  }
  if (!order.service?.trim() && !order.courierServiceId) {
    return { ok: false as const, error: "This order has no saved UPS service. A label cannot pick a different service." };
  }
  return { ok: true as const };
}

export function matchUpsRate(input: {
  service: string | null;
  courierServiceId: string | null;
  rates: UpsLabelRate[];
}) {
  const ups = input.rates.filter((rate) => rate.provider === "ups" && rate.currency === "USD" && rate.amount >= 0);
  if (input.courierServiceId) {
    const byId = ups.filter((rate) => rate.courierServiceId === input.courierServiceId);
    if (byId.length === 1) return byId[0];
    return null;
  }
  const name = String(input.service ?? "").trim().toLowerCase();
  if (!name) return null;
  const byName = ups.filter((rate) => rate.service.trim().toLowerCase() === name);
  return byName.length === 1 ? byName[0] : null;
}

export function amountsMatch(left: number, right: number) {
  return Number.isFinite(left) && Number.isFinite(right) && Math.abs(left - right) < 0.015;
}

export function labelCostComparison(customerShipping: number | null, labelCost: number) {
  const customer = Number.isFinite(customerShipping ?? NaN) ? Number(customerShipping) : null;
  const difference = customer == null ? null : Number((labelCost - customer).toFixed(2));
  return { customerShipping: customer, labelCost: Number(labelCost.toFixed(2)), difference };
}

export function easyshipChargeCoversCarrierFees(rate: Pick<UpsLabelRate, "amount" | "shipmentCharge" | "fuelSurcharge">) {
  const parts = [rate.shipmentCharge, rate.fuelSurcharge].filter((value): value is number => value != null && Number.isFinite(value));
  const knownSum = parts.reduce((sum, value) => sum + value, 0);
  return {
    purchaseAmount: rate.amount,
    shipmentCharge: rate.shipmentCharge,
    fuelSurcharge: rate.fuelSurcharge,
    coversKnownParts: parts.length === 0 || rate.amount + 0.015 >= knownSum,
  };
}

export function easyshipLabelIdempotencyKey(orderId: string, courierServiceId: string, amount: number, attempt = 1) {
  const cents = Math.round(amount * 100);
  const safeAttempt = Number.isFinite(attempt) && attempt > 0 ? Math.trunc(attempt) : 1;
  return `easyship-ups:${orderId}:${courierServiceId}:${cents}:a${safeAttempt}`;
}

export function labelPdfReady(base64: string | null | undefined) {
  const value = String(base64 ?? "").replace(/\s/g, "");
  return value.startsWith("JVBERi");
}

export function trackingNotificationAfterSave(input: { persisted: boolean; trackingNumber: string | null }) {
  if (!input.persisted || !input.trackingNumber) return null;
  return "tracking_added" as const;
}

export type LabelPurchaseDecision =
  | { action: "ineligible"; error: string }
  | { action: "show"; error?: string; rate: UpsLabelRate; comparison: ReturnType<typeof labelCostComparison> }
  | { action: "blocked" | "hold"; error: string; rate: UpsLabelRate; comparison: ReturnType<typeof labelCostComparison> }
  | { action: "quote_changed"; error: string; rate: UpsLabelRate; comparison: ReturnType<typeof labelCostComparison> }
  | { action: "duplicate"; label: StoredUpsLabel }
  | {
      action: "buy" | "resume";
      rate: UpsLabelRate;
      comparison: ReturnType<typeof labelCostComparison>;
      idempotencyKey: string;
      existingShipmentId: string | null;
      attempt: number;
    };

export function decideEasyshipLabelPurchase(input: {
  order: UpsLabelOrder;
  rates: UpsLabelRate[];
  reviewedAmount: number | null;
  reviewedServiceId: string | null;
  confirm: string;
  purchasesEnabled: boolean;
  existing: StoredUpsLabel | null;
  failedAttempts?: number;
  retryMode?: "same" | "new";
}): LabelPurchaseDecision {
  const eligible = upsLabelEligibility(input.order);
  if (!eligible.ok) return { action: "ineligible", error: eligible.error };
  if (input.existing?.status === "purchased") return { action: "duplicate", label: input.existing };

  const rate = matchUpsRate({
    service: input.order.service,
    courierServiceId: input.order.courierServiceId,
    rates: input.rates,
  });
  if (!rate) {
    return { action: "ineligible", error: "The saved UPS service is not in the fresh Easyship quote. No other service was substituted." };
  }
  const comparison = labelCostComparison(input.order.shippingCost, rate.amount);
  if (!easyshipChargeCoversCarrierFees(rate).coversKnownParts) {
    return {
      action: "ineligible",
      error: "The Easyship total is below the listed courier charge and fuel. Nothing was charged.",
    };
  }
  const confirmed = input.confirm.trim() === EASYSHIP_UPS_LABEL_CONFIRM;
  if (!confirmed) return { action: "show", rate, comparison };
  if (!input.purchasesEnabled) {
    return {
      action: "blocked",
      error: "UPS label purchases stay off until founder approval. The reviewed cost was not charged.",
      rate,
      comparison,
    };
  }
  if (input.reviewedAmount == null || !amountsMatch(input.reviewedAmount, rate.amount)) {
    return {
      action: "quote_changed",
      error: "The UPS rate changed. Review the new label cost before buying. Nothing was charged.",
      rate,
      comparison,
    };
  }
  if (input.reviewedServiceId && input.reviewedServiceId !== rate.courierServiceId) {
    return {
      action: "quote_changed",
      error: "The UPS service no longer matches the reviewed quote. Nothing was charged.",
      rate,
      comparison,
    };
  }
  if (input.existing?.status === "failed" && input.retryMode !== "new") {
    return {
      action: "hold",
      error: input.existing.errorMessage || "The last UPS label attempt failed. Nothing new was charged.",
      rate,
      comparison,
    };
  }
  if (input.existing?.status === "purchasing") {
    if (input.existing.errorMessage && /non-UPS|different courier/i.test(input.existing.errorMessage)) {
      return {
        action: "hold",
        error: input.existing.errorMessage,
        rate,
        comparison,
      };
    }
    if (input.existing.labelCost != null && !amountsMatch(input.existing.labelCost, rate.amount)) {
      return {
        action: "quote_changed",
        error: "A purchase is already in progress at a different cost. It was not replaced with a new charge.",
        rate,
        comparison,
      };
    }
    return {
      action: "resume",
      rate,
      comparison,
      idempotencyKey: input.existing.idempotencyKey,
      existingShipmentId: input.existing.easyshipShipmentId,
      attempt: 1,
    };
  }
  const attempt = (input.failedAttempts ?? 0) + 1;
  return {
    action: "buy",
    rate,
    comparison,
    idempotencyKey: easyshipLabelIdempotencyKey(input.order.id, rate.courierServiceId, rate.amount, attempt),
    existingShipmentId: null,
    attempt,
  };
}

export async function runLabelPurchase<T>(
  decision: LabelPurchaseDecision,
  transport: (decision: Extract<LabelPurchaseDecision, { action: "buy" | "resume" }>) => Promise<T>,
) {
  if (decision.action !== "buy" && decision.action !== "resume") {
    return { called: false as const, decision };
  }
  const result = await transport(decision);
  return { called: true as const, decision, result };
}

export function prepareOrderLabelQuote(input: {
  origin: StoreOrigin;
  destination: {
    name?: string;
    phone?: string;
    email?: string;
    address_line_1?: string;
    address_line_2?: string;
    city?: string;
    state?: string;
    postal_code?: string;
    country?: string;
  };
  products: CartParcelProduct[];
  packages: ShippingPackagePreset[];
  defaultPackageId?: string | null;
}) {
  const packed = resolveCartParcel({
    products: input.products,
    packages: input.packages,
    defaultPackageId: input.defaultPackageId,
  });
  if (!packed.parcels.length || packed.missing) {
    return { ok: false as const, error: packed.message ?? "This order cannot be packed. Missing parcel data is never invented." };
  }
  const items = easyshipQuoteItems(input.products.map((product) => ({
    quantity: product.quantity,
    price: product.price,
    description: product.name ?? product.description,
    category_slug: product.category_slug,
    category: product.category,
    hs_code: product.hs_code,
    origin_country_alpha2: product.origin_country_alpha2,
    origin_country: product.origin_country,
  })));
  if (!items.length) {
    return { ok: false as const, error: "Each item needs a selling price before a UPS label can be quoted." };
  }
  const parcels = packed.parcels.map((parcel) => ({
    weightLb: parcel.weightLb,
    lengthIn: parcel.lengthIn,
    widthIn: parcel.widthIn,
    heightIn: parcel.heightIn,
    items: easyshipQuoteItems(parcel.items),
  }));
  const request = buildEasyshipRateRequest({
    origin: input.origin,
    destination: input.destination,
    parcels,
    items,
  });
  const issues = easyshipRateRequestIssues(request);
  if (issues.length) return { ok: false as const, error: "The label quote is missing required parcel or address fields." };
  return {
    ok: true as const,
    request,
    parcels,
    parcelEstimate: describePackedParcels(packed.parcels),
    destinationEmail: input.destination.email?.trim() || null,
  };
}
