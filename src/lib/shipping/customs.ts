function text(value: unknown) {
  return String(value ?? "").trim();
}

export function verifiedCustomsFields(product: {
  hs_code?: string | null;
  origin_country_alpha2?: string | null;
  origin_country?: string | null;
}) {
  const hsCode = text(product.hs_code);
  const origin = text(product.origin_country_alpha2 || product.origin_country).toUpperCase();
  if (hsCode.length < 4 || origin.length !== 2) return null;
  return { hsCode, originCountry: origin };
}

export function cartCustomsReady(
  products: Array<{
    hs_code?: string | null;
    origin_country_alpha2?: string | null;
    origin_country?: string | null;
    name?: string | null;
  }>,
  international: boolean,
) {
  if (!international) return { ok: true as const, missing: [] as string[] };
  const missing = products.filter((product) => !verifiedCustomsFields(product)).map((product) => (
    String(product.name ?? "").trim() || "cart item"
  ));
  if (!missing.length) return { ok: true as const, missing };
  return {
    ok: false as const,
    missing,
    message: "Customs data is missing for this cart. HS codes and origin country are never invented. Store Pickup remains available.",
  };
}
