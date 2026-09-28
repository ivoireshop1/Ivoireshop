export type PriceParse =
  | { ok: true; value: number | null }
  | { ok: false; error: string };

export type StockParse =
  | { ok: true; value: number | null }
  | { ok: false; error: string };

export function parsePriceInput(raw: string): PriceParse {
  const value = raw.trim();
  if (!value) return { ok: true, value: null };
  if (!/^\d+(\.\d{1,2})?$/.test(value)) {
    return { ok: false, error: "Enter a price with at most two decimal places." };
  }
  const amount = Number(value);
  if (!Number.isFinite(amount) || amount < 0) {
    return { ok: false, error: "Price must be 0 or greater." };
  }
  return { ok: true, value: Number(amount.toFixed(2)) };
}

export function parseStockInput(raw: string): StockParse {
  const value = raw.trim();
  if (!value) return { ok: true, value: null };
  if (!/^\d+$/.test(value)) {
    return { ok: false, error: "Inventory must be a whole number of 0 or more." };
  }
  const quantity = Number(value);
  if (!Number.isInteger(quantity) || quantity < 0 || !Number.isFinite(quantity)) {
    return { ok: false, error: "Inventory must be a whole number of 0 or more." };
  }
  return { ok: true, value: quantity };
}

export function formatStockInput(value: number | null | undefined) {
  return value === null || value === undefined ? "" : String(value);
}
