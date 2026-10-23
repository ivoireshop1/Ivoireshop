import { destinationReadyForCarrierQuotes } from "../delivery/destination.ts";
import { originIsComplete, type StoreOrigin } from "../delivery/origin.ts";
import { resolveCartParcel, type CartParcelProduct, type ShippingPackagePreset } from "./packages.ts";
import { shippoShipmentParcels, type ShippoParcelInput } from "./shippo.ts";
import { STEEL_SIX_CART, STEEL_SIX_SHIPPO_DESTINATION } from "./steel-six-cart.ts";

export const SHIPPO_TEST_QUOTE_CONFIRM = "request-one-shippo-test-quote";
export const SHIPPO_TEST_PROBE_COOLDOWN_MS = 120_000;

const lastProbeAtByAdmin = new Map<string, number>();

export function shippoTestProbeCooldownRemaining(lastAt: number | null | undefined, now = Date.now()) {
  if (!lastAt || lastAt > now) return 0;
  return Math.max(0, lastAt + SHIPPO_TEST_PROBE_COOLDOWN_MS - now);
}

export function rememberShippoTestProbe(adminId: string, at = Date.now()) {
  lastProbeAtByAdmin.set(adminId, at);
}

export function shippoTestProbeRemainingForAdmin(adminId: string, extraLastAt?: number | null, now = Date.now()) {
  return shippoTestProbeCooldownRemaining(Math.max(lastProbeAtByAdmin.get(adminId) ?? 0, extraLastAt ?? 0), now);
}

export type ShippoTestQuoteDraft = {
  confirm: string;
  acknowledged: boolean;
};

export function parseShippoTestQuoteDraft(formData: FormData): ShippoTestQuoteDraft {
  return {
    confirm: String(formData.get("confirm") ?? "").trim(),
    acknowledged: formData.get("acknowledge") === "on",
  };
}

export function shippoTestQuoteBlocker(draft: ShippoTestQuoteDraft) {
  if (!draft.acknowledged) return "Confirm that this request uses one Shippo TEST quote and does not buy postage.";
  if (draft.confirm !== SHIPPO_TEST_QUOTE_CONFIRM) {
    return `Type ${SHIPPO_TEST_QUOTE_CONFIRM} to request one Shippo TEST quote.`;
  }
  return null;
}

export function shippoTestQuoteCredentialBlocker(input: { configured: boolean; isTest: boolean; isLive: boolean }) {
  if (!input.configured) return "SHIPPO_API_TOKEN is not configured on this environment.";
  if (input.isLive) return "A live Shippo token is present. This Admin test stays closed until a TEST token is used.";
  if (!input.isTest) return "Shippo TEST token required. Customer checkout rates and postage stay off.";
  return null;
}

function textOr(value: unknown, fallback?: string | null) {
  const text = String(value ?? "").trim();
  return text || fallback || undefined;
}

function numberOr(value: unknown, fallback?: number | string | null) {
  if (value == null || value === "") return fallback ?? undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback ?? undefined;
}

export function mergeSteelSixProducts(rows: Array<Record<string, unknown>> = []): CartParcelProduct[] {
  const byId = new Map(rows.map((row) => [String(row.id ?? ""), row]));
  return STEEL_SIX_CART.map((fixture): CartParcelProduct => {
    const row = byId.get(fixture.id);
    if (!row) return { ...fixture };
    return {
      ...fixture,
      name: textOr(row.name, fixture.name),
      quantity: 1,
      item_weight_lb: numberOr(row.item_weight_lb, fixture.item_weight_lb),
      weight_oz: numberOr(row.weight_oz, fixture.weight_oz),
      packaging_weight_oz: numberOr(row.packaging_weight_oz, fixture.packaging_weight_oz),
      weight_source: textOr(row.weight_source, fixture.weight_source),
      category_slug: textOr(row.category_slug, fixture.category_slug),
      shipping_package_id: textOr(row.shipping_package_id) ?? null,
      ship_weight_lb: numberOr(row.ship_weight_lb),
      ship_length_in: numberOr(row.ship_length_in),
      ship_width_in: numberOr(row.ship_width_in),
      ship_height_in: numberOr(row.ship_height_in),
      dims: row.dims ?? null,
      price: numberOr(row.price, fixture.price),
    };
  });
}

export function prepareSteelSixShippoTestQuote(input: {
  origin: StoreOrigin;
  products?: CartParcelProduct[];
  packages?: ShippingPackagePreset[];
  defaultPackageId?: string | null;
}) {
  if (!originIsComplete(input.origin)) {
    return { ok: false as const, error: "Store origin is incomplete. Save the Delivery origin before requesting a quote." };
  }
  const destination = { ...STEEL_SIX_SHIPPO_DESTINATION };
  if (!destinationReadyForCarrierQuotes(destination)) {
    return { ok: false as const, error: "The Clayton OH test destination is incomplete." };
  }
  const packed = resolveCartParcel({
    products: input.products ?? mergeSteelSixProducts(),
    packages: input.packages ?? [],
    defaultPackageId: input.defaultPackageId,
  });
  if (!packed.parcels.length || packed.missing) {
    return {
      ok: false as const,
      error: packed.message ?? "The six-product cart could not be packed. No Shippo request was sent.",
      packed,
    };
  }
  const parcels: ShippoParcelInput[] = packed.parcels.map((parcel) => ({
    weightLb: parcel.weightLb,
    lengthIn: parcel.lengthIn,
    widthIn: parcel.widthIn,
    heightIn: parcel.heightIn,
  }));
  return {
    ok: true as const,
    destination,
    packed,
    parcels,
    payload: shippoShipmentParcels({ parcels }),
  };
}
