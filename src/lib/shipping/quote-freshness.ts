export type QuoteRequestIdentity = {
  seq: number;
  fingerprint: string;
};

export function quoteResponseIsCurrent(request: QuoteRequestIdentity, latest: QuoteRequestIdentity) {
  return request.seq === latest.seq && request.fingerprint === latest.fingerprint && Boolean(request.fingerprint);
}

export function checkoutQuoteFingerprint(
  address: { addressLine1?: string; city?: string; state?: string; postalCode?: string; country?: string },
  items: Array<{ productId: string; quantity: number; weightOptionId?: string | null }>,
) {
  const cart = items
    .map((item) => `${item.productId}:${item.weightOptionId ?? ""}:${Number(item.quantity)}`)
    .sort()
    .join("|");
  return [
    String(address.addressLine1 ?? "").trim().toLowerCase(),
    String(address.city ?? "").trim().toLowerCase(),
    String(address.state ?? "").trim().toUpperCase(),
    String(address.postalCode ?? "").trim().toUpperCase(),
    String(address.country ?? "").trim().toUpperCase(),
    cart,
  ].join("::");
}
