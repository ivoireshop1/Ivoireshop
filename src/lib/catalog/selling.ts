export type SellingMethod = "each" | "weight" | "fixed_package";
export type SellingUnit = "each" | "lb" | "kg" | "oz" | "bag" | "pack";

export type SellingSettings = {
  sellingMethod: SellingMethod;
  sellingUnit: SellingUnit;
  unitIncrement: number;
  minSellQty: number;
  maxSellQty: number | null;
  packageWeightLb: number | null;
};

export function parseSellingMethod(value: unknown): SellingMethod {
  if (value === "weight" || value === "fixed_package" || value === "each") return value;
  return "each";
}

export function parseSellingUnit(value: unknown): SellingUnit {
  if (value === "lb" || value === "kg" || value === "oz" || value === "bag" || value === "pack" || value === "each") {
    return value;
  }
  return "each";
}

export function parsePositiveDecimal(value: unknown, fallback: number) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : fallback;
}

export function sellingSettingsFromProduct(product: {
  selling_method?: string | null;
  selling_unit?: string | null;
  unit_increment?: number | string | null;
  min_sell_qty?: number | string | null;
  max_sell_qty?: number | string | null;
  package_weight_lb?: number | string | null;
}): SellingSettings {
  const sellingMethod = parseSellingMethod(product.selling_method);
  const sellingUnit = sellingMethod === "each" ? "each" : parseSellingUnit(product.selling_unit);
  const unitIncrement = parsePositiveDecimal(product.unit_increment, sellingMethod === "weight" ? 0.5 : 1);
  const minSellQty = parsePositiveDecimal(product.min_sell_qty, unitIncrement);
  const maxRaw = product.max_sell_qty === null || product.max_sell_qty === undefined || product.max_sell_qty === ""
    ? null
    : Number(product.max_sell_qty);
  const maxSellQty = maxRaw !== null && Number.isFinite(maxRaw) && maxRaw >= minSellQty ? maxRaw : null;
  const packageWeight = product.package_weight_lb === null || product.package_weight_lb === undefined || product.package_weight_lb === ""
    ? null
    : Number(product.package_weight_lb);
  return {
    sellingMethod,
    sellingUnit: sellingMethod === "each" ? "each" : sellingUnit === "each" && sellingMethod === "weight" ? "lb" : sellingUnit,
    unitIncrement,
    minSellQty,
    maxSellQty,
    packageWeightLb: packageWeight !== null && Number.isFinite(packageWeight) && packageWeight >= 0 ? packageWeight : null,
  };
}

export function isWeightBased(settings: Pick<SellingSettings, "sellingMethod">) {
  return settings.sellingMethod === "weight";
}

export function unitLabel(unit: SellingUnit, quantity = 1) {
  if (unit === "each") return quantity === 1 ? "item" : "items";
  if (unit === "lb") return "lb";
  if (unit === "kg") return "kg";
  if (unit === "oz") return "oz";
  if (unit === "bag") return quantity === 1 ? "bag" : "bags";
  if (unit === "pack") return quantity === 1 ? "pack" : "packs";
  return unit;
}

export function formatSellQuantity(quantity: number, unit: SellingUnit) {
  const rounded = roundQty(quantity);
  if (unit === "each") return `${Math.round(rounded)}`;
  const text = Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(3).replace(/\.?0+$/, "");
  return `${text} ${unitLabel(unit, rounded)}`;
}

export function roundQty(value: number) {
  return Math.round(value * 1000) / 1000;
}

export function roundMoney(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

export function lineSubtotal(unitPrice: number, quantity: number) {
  return roundMoney(unitPrice * quantity);
}

export function snapQuantity(value: number, settings: SellingSettings) {
  const { unitIncrement, minSellQty, maxSellQty } = settings;
  let next = roundQty(value);
  if (next < minSellQty) next = minSellQty;
  if (maxSellQty != null && next > maxSellQty) next = maxSellQty;
  const steps = Math.round((next - minSellQty) / unitIncrement);
  next = roundQty(minSellQty + steps * unitIncrement);
  if (maxSellQty != null && next > maxSellQty) {
    const maxSteps = Math.floor((maxSellQty - minSellQty) / unitIncrement + 1e-9);
    next = roundQty(minSellQty + maxSteps * unitIncrement);
  }
  if (next < minSellQty) next = minSellQty;
  return next;
}

export function isValidSellQuantity(quantity: number, settings: SellingSettings) {
  if (!Number.isFinite(quantity) || quantity <= 0) return false;
  const snapped = snapQuantity(quantity, settings);
  if (Math.abs(snapped - roundQty(quantity)) > 0.0005) return false;
  if (settings.sellingMethod === "each" && !Number.isInteger(roundQty(quantity))) return false;
  return true;
}

/** Convert purchased selling quantity into carrier billable pounds for one line. */
export function lineShipWeightLb(input: {
  settings: SellingSettings;
  quantity: number;
  shipWeightLb?: number | null;
}): number | null {
  const qty = roundQty(input.quantity);
  const packageLb = input.settings.packageWeightLb ?? 0;
  if (input.settings.sellingMethod === "weight") {
    let productLb = qty;
    if (input.settings.sellingUnit === "kg") productLb = qty * 2.2046226218;
    else if (input.settings.sellingUnit === "oz") productLb = qty / 16;
    else if (input.settings.sellingUnit !== "lb") return null;
    return roundQty(productLb + packageLb);
  }
  const unitShip = input.shipWeightLb != null && Number.isFinite(Number(input.shipWeightLb)) ? Number(input.shipWeightLb) : null;
  if (unitShip == null || unitShip <= 0) return null;
  return roundQty(unitShip * qty + packageLb);
}
