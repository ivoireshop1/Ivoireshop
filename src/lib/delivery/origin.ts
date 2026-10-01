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

export function originIsComplete(origin: StoreOrigin) {
  return Boolean(origin.name && origin.address_line_1 && origin.city && origin.postal_code && origin.country);
}
