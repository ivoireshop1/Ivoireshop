export const ORDER_PRINT_KINDS = ["packing-slip", "receipt", "summary", "delivery"] as const;
export type OrderPrintKind = (typeof ORDER_PRINT_KINDS)[number];

export const CATALOG_PRINT_KINDS = ["products", "inventory", "low-stock"] as const;
export type CatalogPrintKind = (typeof CATALOG_PRINT_KINDS)[number];

export function isOrderPrintKind(value: string | null | undefined): value is OrderPrintKind {
  return Boolean(value && (ORDER_PRINT_KINDS as readonly string[]).includes(value));
}

export function isCatalogPrintKind(value: string | null | undefined): value is CatalogPrintKind {
  return Boolean(value && (CATALOG_PRINT_KINDS as readonly string[]).includes(value));
}

export function money(value: number | string | null | undefined) {
  return `$${Number(value ?? 0).toFixed(2)}`;
}

export type PrintAddress = {
  address_line_1?: string | null;
  address_line_2?: string | null;
  city?: string | null;
  state?: string | null;
  postal_code?: string | null;
  country?: string | null;
};

export function formatPrintAddress(address: PrintAddress | null | undefined) {
  if (!address) return "";
  return [
    address.address_line_1,
    address.address_line_2,
    [address.city, address.state, address.postal_code].filter(Boolean).join(", "),
    address.country,
  ]
    .map((part) => (typeof part === "string" ? part.trim() : ""))
    .filter(Boolean)
    .join("\n");
}

export function orderPrintTitle(kind: OrderPrintKind) {
  switch (kind) {
    case "packing-slip":
      return "Packing Slip";
    case "receipt":
      return "Customer Receipt";
    case "summary":
      return "Order Summary";
    case "delivery":
      return "Delivery / Shipping Sheet";
  }
}

export function catalogPrintTitle(kind: CatalogPrintKind) {
  switch (kind) {
    case "products":
      return "Product List";
    case "inventory":
      return "Inventory Report";
    case "low-stock":
      return "Low Stock Report";
  }
}
