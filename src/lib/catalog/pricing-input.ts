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
  const [whole, fraction = ""] = value.split(".");
  const cents = Number(whole) * 100 + Number((fraction + "00").slice(0, 2));
  if (!Number.isInteger(cents) || cents < 0 || !Number.isFinite(cents)) {
    return { ok: false, error: "Price must be 0 or greater." };
  }
  return { ok: true, value: cents / 100 };
}

export function formatPriceDisplay(value: number | null | undefined) {
  if (value === null || value === undefined) return "";
  return value.toFixed(2);
}

export function priceStatusFromDraft(raw: string) {
  const parsed = parsePriceInput(raw);
  if (!parsed.ok) return null;
  if (parsed.value === null || parsed.value <= 0) return "Needs pricing";
  return `$${parsed.value.toFixed(2)}`;
}

export function inventoryStatusFromDraft(raw: string) {
  const parsed = parseStockInput(raw);
  if (!parsed.ok) return null;
  if (parsed.value === null) return "Needs stock";
  if (parsed.value === 0) return "Out of stock";
  if (parsed.value <= 5) return "Low stock";
  return "In stock";
}

export function draftsReadyForActivation(priceInput: string, stockInput: string): { ok: true } | { ok: false; error: string } {
  const price = parsePriceInput(priceInput);
  if (!price.ok) return price;
  if (price.value === null || price.value <= 0) {
    return { ok: false, error: "Add a valid price before activating this product." };
  }
  const stock = parseStockInput(stockInput);
  if (!stock.ok) return stock;
  if (stock.value === null) {
    return { ok: false, error: "Add a valid stock quantity before activating this product." };
  }
  return { ok: true };
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
