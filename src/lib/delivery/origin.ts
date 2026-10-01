export type StoreOrigin = {
  name: string;
  address_line_1: string;
  address_line_2: string;
  city: string;
  state: string;
  postal_code: string;
  country: string;
  phone: string;
};

export function originFromSettings(row: Record<string, unknown> | null | undefined): StoreOrigin {
  return {
    name: String(row?.origin_name ?? "").trim(),
    address_line_1: String(row?.origin_address_line_1 ?? "").trim(),
    address_line_2: String(row?.origin_address_line_2 ?? "").trim(),
    city: String(row?.origin_city ?? "").trim(),
    state: String(row?.origin_state ?? "").trim(),
    postal_code: String(row?.origin_postal_code ?? "").trim(),
    country: String(row?.origin_country ?? "").trim(),
    phone: String(row?.origin_phone ?? "").trim(),
  };
}

type OriginCore = {
  name: string;
  address_line_1: string;
  address_line_2?: string;
  city: string;
  state?: string;
  postal_code: string;
  country: string;
};

export function originIsComplete(origin: OriginCore) {
  return Boolean(origin.name && origin.address_line_1 && origin.city && origin.postal_code && origin.country);
}

export function displayOriginCountry(country: string) {
  const value = country.trim();
  if (/^(US|USA|United States of America)$/i.test(value)) return "United States";
  return value;
}

export function formatOriginLines(origin: OriginCore | null | undefined) {
  if (!origin || !originIsComplete(origin)) return [];
  const locality = [origin.city, [origin.state, origin.postal_code].filter(Boolean).join(" ")].filter(Boolean).join(", ");
  return [origin.address_line_1, origin.address_line_2 ?? "", locality, displayOriginCountry(origin.country)]
    .map((line) => line.trim())
    .filter(Boolean);
}

export type PickupLocationSnapshot = {
  name: string;
  address_line_1: string;
  address_line_2: string;
  city: string;
  state: string;
  postal_code: string;
  country: string;
};

export function pickupLocationSnapshot(origin: StoreOrigin): PickupLocationSnapshot {
  return {
    name: origin.name,
    address_line_1: origin.address_line_1,
    address_line_2: origin.address_line_2,
    city: origin.city,
    state: origin.state,
    postal_code: origin.postal_code,
    country: origin.country,
  };
}

export function pickupLocationFromUnknown(value: unknown): PickupLocationSnapshot | null {
  if (!value || typeof value !== "object") return null;
  const row = value as Record<string, unknown>;
  const nested = row.pickup_location && typeof row.pickup_location === "object" ? (row.pickup_location as Record<string, unknown>) : row;
  const origin = originFromSettings({
    origin_name: nested.name ?? nested.origin_name,
    origin_address_line_1: nested.address_line_1 ?? nested.origin_address_line_1,
    origin_address_line_2: nested.address_line_2 ?? nested.origin_address_line_2,
    origin_city: nested.city ?? nested.origin_city,
    origin_state: nested.state ?? nested.origin_state,
    origin_postal_code: nested.postal_code ?? nested.origin_postal_code,
    origin_country: nested.country ?? nested.origin_country,
  });
  return originIsComplete(origin) ? pickupLocationSnapshot(origin) : null;
}
