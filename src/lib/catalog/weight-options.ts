import { parsePositive } from "../delivery/package.ts";
import { customerWeightSelectionAllowed, roundMoney, roundQty } from "./selling.ts";

export type WeightOptionUnit = "lb" | "kg";

export type ProductWeightOption = {
  id: string;
  productId: string;
  label: string;
  unit: WeightOptionUnit;
  netWeight: number;
  netWeightLb: number;
  packagedWeightLb: number | null;
  price: number;
  stockQuantity: number | null;
  trackInventory: boolean;
  isEnabled: boolean;
  sortOrder: number;
};

export function parseWeightOptionUnit(value: unknown): WeightOptionUnit {
  return value === "kg" ? "kg" : "lb";
}

export function netWeightToLb(value: number, unit: WeightOptionUnit) {
  const amount = Number(value);
  if (!Number.isFinite(amount) || amount <= 0) return null;
  return roundQty(unit === "kg" ? amount * 2.2046226218 : amount);
}

export function parseWeightOption(row: unknown): ProductWeightOption | null {
  if (!row || typeof row !== "object") return null;
  const value = row as Record<string, unknown>;
  const id = String(value.id ?? "").trim();
  const productId = String(value.product_id ?? value.productId ?? "").trim();
  const label = String(value.label ?? "").trim();
  const unit = parseWeightOptionUnit(value.unit);
  const netWeight = parsePositive(value.net_weight ?? value.netWeight);
  const netWeightLb = parsePositive(value.net_weight_lb ?? value.netWeightLb) ?? (netWeight ? netWeightToLb(netWeight, unit) : null);
  const price = Number(value.price);
  if (!id || !productId || !label || !netWeight || !netWeightLb || !Number.isFinite(price) || price <= 0) return null;
  const packaged = value.packaged_weight_lb ?? value.packagedWeightLb;
  const packagedWeightLb = packaged == null || packaged === "" ? null : parsePositive(packaged);
  const stockRaw = value.stock_quantity ?? value.stockQuantity;
  const stockQuantity = stockRaw == null || stockRaw === "" ? null : Number(stockRaw);
  return {
    id,
    productId,
    label,
    unit,
    netWeight,
    netWeightLb,
    packagedWeightLb,
    price: roundMoney(price),
    stockQuantity: stockQuantity != null && Number.isFinite(stockQuantity) ? stockQuantity : null,
    trackInventory: value.track_inventory !== false && value.trackInventory !== false,
    isEnabled: value.is_enabled !== false && value.isEnabled !== false,
    sortOrder: Number(value.sort_order ?? value.sortOrder ?? 0) || 0,
  };
}

export function enabledWeightOptions(options: Array<ProductWeightOption | null | undefined>) {
  return options
    .filter((option): option is ProductWeightOption => Boolean(option?.isEnabled && option.netWeightLb > 0 && option.price > 0))
    .sort((a, b) => a.sortOrder - b.sortOrder || a.netWeightLb - b.netWeightLb);
}

export function storefrontWeightChoices(
  sellingMethod: string | null | undefined,
  options: Array<ProductWeightOption | null | undefined>,
) {
  return customerWeightSelectionAllowed(sellingMethod) ? enabledWeightOptions(options) : [];
}

export function packagedLineWeightLb(option: ProductWeightOption, quantity: number, productTareLb = 0) {
  const qty = Number(quantity);
  if (!Number.isFinite(qty) || qty <= 0) return null;
  const unitPackaged = option.packagedWeightLb != null && option.packagedWeightLb > 0
    ? option.packagedWeightLb
    : option.netWeightLb + (productTareLb > 0 ? productTareLb : 0);
  if (unitPackaged <= 0) return null;
  return roundQty(unitPackaged * qty);
}

export function cartLineKey(productId: string, weightOptionId?: string | null) {
  return weightOptionId ? `${productId}::${weightOptionId}` : productId;
}

export function weightOptionLabel(option: Pick<ProductWeightOption, "label" | "netWeight" | "unit">) {
  return option.label.trim() || `${option.netWeight} ${option.unit}`;
}
