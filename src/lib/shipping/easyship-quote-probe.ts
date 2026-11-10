import { destinationReadyForCarrierQuotes } from "../delivery/destination.ts";
import { originIsComplete, type StoreOrigin } from "../delivery/origin.ts";
import { buildEasyshipRateRequest, easyshipQuoteItems, easyshipRateRequestIssues } from "./easyship.ts";
import { describePackedParcels, resolveCartParcel, type CartParcelProduct, type ShippingPackagePreset } from "./packages.ts";
import { mergeSteelSixProducts } from "./shippo-test-quote.ts";
import { STEEL_SIX_CART, STEEL_SIX_SHIPPO_DESTINATION } from "./steel-six-cart.ts";

export const EASYSHIP_PRODUCTION_QUOTE_CONFIRM = "request-one-easyship-production-quote";
export const EASYSHIP_PROBE_COOLDOWN_MS = 120_000;

export const STEEL_SIX_EASYSHIP_DESTINATION = {
  name: "Steel test recipient",
  address_line_1: STEEL_SIX_SHIPPO_DESTINATION.address_line_1,
  city: STEEL_SIX_SHIPPO_DESTINATION.city,
  state: STEEL_SIX_SHIPPO_DESTINATION.state,
  postal_code: STEEL_SIX_SHIPPO_DESTINATION.postal_code,
  country: STEEL_SIX_SHIPPO_DESTINATION.country,
} as const;

const lastProbeAtByAdmin = new Map<string, number>();

export function easyshipProbeCooldownRemaining(lastAt: number | null | undefined, now = Date.now()) {
  if (!lastAt || lastAt > now) return 0;
  return Math.max(0, lastAt + EASYSHIP_PROBE_COOLDOWN_MS - now);
}

export function rememberEasyshipProbe(adminId: string, at = Date.now()) {
  lastProbeAtByAdmin.set(adminId, at);
}

export function easyshipProbeRemainingForAdmin(adminId: string, extraLastAt?: number | null, now = Date.now()) {
  return easyshipProbeCooldownRemaining(Math.max(lastProbeAtByAdmin.get(adminId) ?? 0, extraLastAt ?? 0), now);
}

export type EasyshipQuoteProbeDraft = {
  confirm: string;
};

export function parseEasyshipQuoteProbeDraft(formData: FormData): EasyshipQuoteProbeDraft {
  return {
    confirm: String(formData.get("confirm") ?? "").trim(),
  };
}

export function easyshipQuoteProbeBlocker(draft: EasyshipQuoteProbeDraft) {
  if (draft.confirm !== EASYSHIP_PRODUCTION_QUOTE_CONFIRM) {
    return `Use the Admin confirmation button to request one production quote.`;
  }
  return null;
}

export function steelSixSellingPrice(value: unknown) {
  const amount = Number(value);
  return Number.isFinite(amount) && amount > 0 ? Number(amount.toFixed(2)) : null;
}

export function steelSixPriceGaps(products: Array<{ name?: string | null; price?: number | string | null }>) {
  return products
    .filter((product) => steelSixSellingPrice(product.price) == null)
    .map((product) => String(product.name ?? "").trim() || "cart item");
}

function quoteProducts(products: CartParcelProduct[]) {
  return products.map((product) => ({
    quantity: product.quantity,
    price: product.price,
    description: product.name ?? product.description,
    category_slug: product.category_slug,
    category: product.category,
    hs_code: product.hs_code,
    origin_country_alpha2: product.origin_country_alpha2,
    origin_country: product.origin_country,
  }));
}

export function prepareSteelSixEasyshipQuote(input: {
  origin: StoreOrigin;
  products?: CartParcelProduct[];
  packages?: ShippingPackagePreset[];
  defaultPackageId?: string | null;
}) {
  if (!originIsComplete(input.origin)) {
    return { ok: false as const, error: "Store origin is incomplete. Save the Delivery origin before requesting a quote." };
  }
  const destination = { ...STEEL_SIX_EASYSHIP_DESTINATION };
  if (!destinationReadyForCarrierQuotes(destination)) {
    return { ok: false as const, error: "The Clayton OH test destination is incomplete." };
  }
  const products = input.products ?? mergeSteelSixProducts();
  if (products.length !== STEEL_SIX_CART.length) {
    return { ok: false as const, error: "The six-product Steel fixture is incomplete. Missing products are never invented." };
  }
  const missingPrices = steelSixPriceGaps(products);
  if (missingPrices.length) {
    return {
      ok: false as const,
      error: `Selling prices are missing for ${missingPrices.join(", ")}. Declared value uses Steel catalog prices only and is never invented.`,
      missingPrices,
    };
  }
  const packed = resolveCartParcel({
    products,
    packages: input.packages ?? [],
    defaultPackageId: input.defaultPackageId,
  });
  if (!packed.parcels.length || packed.missing) {
    return {
      ok: false as const,
      error: packed.message ?? "The six-product cart could not be packed. No Easyship request was sent.",
      packed,
    };
  }
  const items = easyshipQuoteItems(quoteProducts(products));
  if (items.length !== products.length) {
    return { ok: false as const, error: "A Steel catalog price could not be used as declared value. Prices are never invented." };
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
    destination,
    parcels,
    items,
  });
  const issues = easyshipRateRequestIssues(request);
  if (issues.length) {
    return { ok: false as const, error: "The Easyship rate request body is not valid. No substitute rate was invented.", issues };
  }
  const declaredValue = Number(items.reduce((sum, item) => (
    sum + Number(item.declared_customs_value) * Number(item.quantity)
  ), 0).toFixed(2));
  return {
    ok: true as const,
    destination,
    products,
    packed,
    parcels,
    request,
    items,
    declaredValue,
    parcelEstimate: describePackedParcels(packed.parcels),
  };
}
