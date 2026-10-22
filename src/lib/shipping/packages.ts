import { packageFromProduct, parsePositive, type PackageDims } from "../delivery/package.ts";
import { lineShipWeightLb, sellingSettingsFromProduct } from "../catalog/selling.ts";
import { isAiWeightSource, parseDims, quoteUnitWeightLb } from "../catalog/shipping-weight.ts";
import { packagedLineWeightLb, type ProductWeightOption } from "../catalog/weight-options.ts";
import { categoryEstimateWeightLb, producePackagingAllowanceLb, type CategoryShippingDefault } from "./estimate-rules.ts";
import { ESTIMATED_PACKAGING_PRESETS, withEstimateAllowanceLb } from "./estimated-presets.ts";

export type ParcelFailureCode =
  | "missing_weight"
  | "missing_box"
  | "oversized"
  | "overweight"
  | "capacity_exceeded"
  | "missing_parcel";

export type ShippingPackagePreset = {
  id: string;
  name: string;
  lengthIn: number;
  widthIn: number;
  heightIn: number;
  maxWeightLb: number;
  tareWeightLb: number;
  isActive: boolean;
  estimated?: boolean;
};

export type CartParcelProduct = {
  quantity: number;
  selling_method?: string | null;
  selling_unit?: string | null;
  unit_increment?: number | string | null;
  min_sell_qty?: number | string | null;
  max_sell_qty?: number | string | null;
  package_weight_lb?: number | string | null;
  ship_weight_lb?: number | string | null;
  ship_length_in?: number | string | null;
  ship_width_in?: number | string | null;
  ship_height_in?: number | string | null;
  item_weight_lb?: number | string | null;
  shipping_package_id?: string | null;
  weight_oz?: number | string | null;
  packaging_weight_oz?: number | string | null;
  weight_source?: string | null;
  dims?: unknown;
  weightOption?: ProductWeightOption | null;
  category_slug?: string | null;
  category?: string | null;
  name?: string | null;
  description?: string | null;
  price?: number | string | null;
  hs_code?: string | null;
  origin_country_alpha2?: string | null;
  origin_country?: string | null;
};

export type PackedParcel = PackageDims & {
  items: Array<{ description: string; quantity: number; price?: number | string | null }>;
  estimatedBox?: boolean;
  boxId?: string;
  boxName?: string;
  unknownItemDimensions?: boolean;
};

export type ShippingReviewItem = {
  name: string;
  source: string;
  reason: string;
};

export function parseShippingPackage(row: unknown): ShippingPackagePreset | null {
  if (!row || typeof row !== "object") return null;
  const value = row as Record<string, unknown>;
  const id = String(value.id ?? "").trim();
  const name = String(value.name ?? "").trim();
  const lengthIn = parsePositive(value.length_in ?? value.lengthIn);
  const widthIn = parsePositive(value.width_in ?? value.widthIn);
  const heightIn = parsePositive(value.height_in ?? value.heightIn);
  const maxWeightLb = parsePositive(value.max_weight_lb ?? value.maxWeightLb);
  const tareRaw = value.tare_weight_lb ?? value.tareWeightLb;
  const tareWeightLb = tareRaw == null || tareRaw === "" ? 0 : Number(tareRaw);
  if (!id || !name || !lengthIn || !widthIn || !heightIn || !maxWeightLb) return null;
  if (!Number.isFinite(tareWeightLb) || tareWeightLb < 0) return null;
  return {
    id,
    name,
    lengthIn,
    widthIn,
    heightIn,
    maxWeightLb,
    tareWeightLb,
    isActive: value.is_active !== false && value.isActive !== false,
  };
}

export function parcelFailureMessage(code: ParcelFailureCode) {
  switch (code) {
    case "missing_weight":
      return "A product shipping weight is missing. UPS/USPS quotes stay off until a verified or estimated weight is saved. This is not an Easyship authentication error.";
    case "missing_box":
      return "No measured shipping box is assigned and no estimated packaging preset can cover this cart. UPS/USPS quotes stay off. This is not an Easyship authentication error.";
    case "oversized":
      return "An item is larger than the assigned or estimated shipping box. No substitute dimensions were invented.";
    case "overweight":
    case "capacity_exceeded":
      return "Packed weight exceeds the box capacity, including the 10% estimate allowance when an estimated box is used. No larger invented box or carrier price was created.";
    default:
      return "Package weight and dimensions are required for UPS/USPS quotes. Missing product shipping data is never invented.";
  }
}

export function itemFitsPackage(
  item: { lengthIn?: number | null; widthIn?: number | null; heightIn?: number | null },
  box: ShippingPackagePreset,
) {
  const lengthIn = parsePositive(item.lengthIn);
  const widthIn = parsePositive(item.widthIn);
  const heightIn = parsePositive(item.heightIn);
  if (!lengthIn || !widthIn || !heightIn) return true;
  const itemSides = [lengthIn, widthIn, heightIn].sort((a, b) => b - a);
  const boxSides = [box.lengthIn, box.widthIn, box.heightIn].sort((a, b) => b - a);
  return itemSides.every((side, index) => side <= boxSides[index] + 1e-9);
}

export function packedWeightLb(itemWeightLb: number, tareWeightLb = 0) {
  return Number((itemWeightLb + tareWeightLb).toFixed(3));
}

export function pickSuitablePackage(input: {
  packedWeightLb: number;
  itemDims?: { lengthIn?: number | null; widthIn?: number | null; heightIn?: number | null } | null;
  packages: ShippingPackagePreset[];
}): { package: ShippingPackagePreset } | { code: ParcelFailureCode } {
  const usable = input.packages.filter((preset) => preset.isActive);
  if (!usable.length) return { code: "missing_box" };
  const fits = usable.filter((preset) => (
    input.packedWeightLb <= preset.maxWeightLb + 1e-9
    && itemFitsPackage(input.itemDims ?? {}, preset)
  ));
  if (!fits.length) {
    const anyBox = usable.some((preset) => itemFitsPackage(input.itemDims ?? {}, preset));
    return { code: anyBox ? "capacity_exceeded" : "oversized" };
  }
  return {
    package: [...fits].sort((a, b) => (
      a.maxWeightLb - b.maxWeightLb
      || a.lengthIn * a.widthIn * a.heightIn - b.lengthIn * b.widthIn * b.heightIn
    ))[0],
  };
}

function lineDescription(product: CartParcelProduct) {
  return String(product.name ?? product.description ?? "").trim().slice(0, 200) || "Ivoire Shop grocery item";
}

export function lineItemWeightLb(
  product: CartParcelProduct,
  defaults?: Record<string, CategoryShippingDefault>,
): { weightLb: number; source: string; estimated: boolean; alreadyBuffered: boolean; review?: string } | null {
  const qty = Number(product.quantity);
  if (!Number.isFinite(qty) || qty <= 0) return null;
  const packagingLb = producePackagingAllowanceLb(product);
  if (product.weightOption) {
    const weightLb = packagedLineWeightLb(product.weightOption, qty, packagingLb);
    if (weightLb == null || weightLb <= 0) return null;
    return { weightLb, source: "weight_option", estimated: false, alreadyBuffered: false };
  }
  const settings = sellingSettingsFromProduct(product);
  const quoted = quoteUnitWeightLb(product);
  if (settings.sellingMethod === "weight") {
    const sold = lineShipWeightLb({
      settings: { ...settings, packageWeightLb: packagingLb },
      quantity: qty,
      shipWeightLb: quoted ?? parsePositive(product.item_weight_lb) ?? parsePositive(product.ship_weight_lb),
    });
    if (sold == null || sold <= 0) return null;
    const estimated = isAiWeightSource(product.weight_source);
    return {
      weightLb: sold,
      source: product.weight_source ?? "selected_pounds",
      estimated,
      alreadyBuffered: estimated,
    };
  }
  if (quoted != null) {
    const estimated = isAiWeightSource(product.weight_source);
    return {
      weightLb: Number((quoted * qty).toFixed(3)),
      source: product.weight_source ?? "catalog",
      estimated,
      alreadyBuffered: estimated,
    };
  }
  const packOz = parsePositive(product.packaging_weight_oz)
    ?? (parsePositive(product.package_weight_lb) != null ? Number((Number(product.package_weight_lb) * 16).toFixed(3)) : null);
  const estimate = categoryEstimateWeightLb(product.category_slug ?? product.category, defaults, packOz);
  if (estimate == null) return null;
  return {
    weightLb: Number((estimate * qty).toFixed(3)),
    source: "category_estimate",
    estimated: true,
    alreadyBuffered: true,
    review: "Category estimate used. Verify on a scale before treating as measured shipping weight.",
  };
}

function unitWeightForBox(unit: { weightLb: number; alreadyBuffered: boolean }, box: ShippingPackagePreset) {
  return withEstimateAllowanceLb(unit.weightLb, box.estimated ? unit.alreadyBuffered : true);
}

function measuredPackages(packages: ShippingPackagePreset[]) {
  return packages.filter((preset) => preset.isActive && !preset.estimated);
}

function estimatedPackages(useEstimatedPresets: boolean) {
  return useEstimatedPresets ? ESTIMATED_PACKAGING_PRESETS.filter((preset) => preset.isActive) : [];
}

function candidatesForUnit(
  unit: { assignedId: string },
  packages: ShippingPackagePreset[],
  useEstimatedPresets: boolean,
) {
  const measured = measuredPackages(packages);
  if (unit.assignedId) {
    const assigned = measured.find((preset) => preset.id === unit.assignedId) ?? null;
    return assigned ? [assigned] : [];
  }
  if (measured.length) return measured;
  return estimatedPackages(useEstimatedPresets);
}

function pickBoxForWeightAndDims(input: {
  unit: {
    weightLb: number;
    alreadyBuffered: boolean;
    dims: { lengthIn?: number | null; widthIn?: number | null; heightIn?: number | null } | null;
  };
  packages: ShippingPackagePreset[];
}): { package: ShippingPackagePreset } | { code: ParcelFailureCode } {
  const usable = input.packages.filter((preset) => preset.isActive);
  if (!usable.length) return { code: "missing_box" };
  const fits = usable.filter((preset) => {
    const packed = packedWeightLb(unitWeightForBox(input.unit, preset), preset.tareWeightLb);
    return packed <= preset.maxWeightLb + 1e-9 && itemFitsPackage(input.unit.dims ?? {}, preset);
  });
  if (!fits.length) {
    const anyBox = usable.some((preset) => itemFitsPackage(input.unit.dims ?? {}, preset));
    return { code: anyBox ? "capacity_exceeded" : "oversized" };
  }
  return {
    package: [...fits].sort((a, b) => (
      a.maxWeightLb - b.maxWeightLb
      || a.lengthIn * a.widthIn * a.heightIn - b.lengthIn * b.widthIn * b.heightIn
    ))[0],
  };
}

export function resolveLineParcel(input: {
  product: CartParcelProduct;
  packages: ShippingPackagePreset[];
  defaultPackageId?: string | null;
  useEstimatedPresets?: boolean;
}): { parcel: PackageDims & { estimatedBox?: boolean; boxId?: string; boxName?: string } } | { code: ParcelFailureCode } {
  const preferred = packageFromProduct(input.product);
  const aiSource = input.product.weight_source === "ai_text" || input.product.weight_source === "ai_image" || input.product.weight_source === "ai_estimate";
  if (preferred && !aiSource) return { parcel: preferred };

  const lengthIn = parsePositive(input.product.ship_length_in);
  const widthIn = parsePositive(input.product.ship_width_in);
  const heightIn = parsePositive(input.product.ship_height_in);
  const dims = parseDims(input.product.dims) ?? (lengthIn && widthIn && heightIn ? { lengthIn, widthIn, heightIn } : null);
  const itemWeight = lineItemWeightLb(input.product);
  const itemWeightLb = itemWeight?.weightLb ?? null;
  if (itemWeightLb == null || itemWeightLb <= 0) return { code: "missing_weight" };
  const assignedId = String(input.product.shipping_package_id ?? "").trim() || input.defaultPackageId || "";
  const assigned = input.packages.find((preset) => preset.id === assignedId && preset.isActive) ?? null;
  if (dims) {
    if (assigned && !itemFitsPackage(dims, assigned)) return { code: "oversized" };
    if (!assigned) {
      return { parcel: { weightLb: itemWeightLb, lengthIn: dims.lengthIn, widthIn: dims.widthIn, heightIn: dims.heightIn } };
    }
  }
  const unit = {
    weightLb: itemWeightLb,
    alreadyBuffered: itemWeight?.alreadyBuffered ?? false,
    dims,
    assignedId,
  };
  const useEstimatedPresets = input.useEstimatedPresets !== false;
  const primary = assigned ? [assigned] : candidatesForUnit(unit, input.packages, useEstimatedPresets);
  let picked = pickBoxForWeightAndDims({ unit, packages: primary });
  if ("code" in picked && !assignedId && measuredPackages(input.packages).length) {
    picked = pickBoxForWeightAndDims({ unit, packages: estimatedPackages(useEstimatedPresets) });
  }
  if ("code" in picked) return picked;
  const weightLb = packedWeightLb(unitWeightForBox(unit, picked.package), picked.package.tareWeightLb);
  if (weightLb > picked.package.maxWeightLb + 1e-9) return { code: "capacity_exceeded" };
  return {
    parcel: {
      weightLb,
      lengthIn: picked.package.lengthIn,
      widthIn: picked.package.widthIn,
      heightIn: picked.package.heightIn,
      estimatedBox: Boolean(picked.package.estimated),
      boxId: picked.package.id,
      boxName: picked.package.name,
    },
  };
}

type PackUnit = {
  weightLb: number;
  alreadyBuffered: boolean;
  estimatedWeight: boolean;
  unknownDims: boolean;
  dims: { lengthIn?: number | null; widthIn?: number | null; heightIn?: number | null } | null;
  assignedId: string;
  item: PackedParcel["items"][number];
};

function packUnitsIntoBoxes(
  units: PackUnit[],
  packages: ShippingPackagePreset[],
  useEstimatedPresets: boolean,
): { parcels: PackedParcel[] } | { code: ParcelFailureCode } {
  const open: Array<{ preset: ShippingPackagePreset; remaining: number; units: PackUnit[] }> = [];
  const sorted = [...units].sort((a, b) => b.weightLb - a.weightLb);
  for (const unit of sorted) {
    const existing = open.find((box) => {
      if (unit.assignedId && box.preset.id !== unit.assignedId) return false;
      if (!itemFitsPackage(unit.dims ?? {}, box.preset)) return false;
      return unitWeightForBox(unit, box.preset) <= box.remaining + 1e-9;
    });
    if (existing) {
      existing.units.push(unit);
      existing.remaining = Number((existing.remaining - unitWeightForBox(unit, existing.preset)).toFixed(3));
      continue;
    }
    const primary = candidatesForUnit(unit, packages, useEstimatedPresets);
    let picked = pickBoxForWeightAndDims({ unit, packages: primary });
    if ("code" in picked && !unit.assignedId && measuredPackages(packages).length) {
      picked = pickBoxForWeightAndDims({ unit, packages: estimatedPackages(useEstimatedPresets) });
    }
    if ("code" in picked) return picked;
    const usedWeight = unitWeightForBox(unit, picked.package);
    const remaining = Number((picked.package.maxWeightLb - packedWeightLb(usedWeight, picked.package.tareWeightLb)).toFixed(3));
    if (remaining < -1e-9) return { code: "capacity_exceeded" };
    open.push({ preset: picked.package, remaining, units: [unit] });
  }
  return {
    parcels: open.map((box) => ({
      weightLb: packedWeightLb(box.units.reduce((sum, unit) => sum + unitWeightForBox(unit, box.preset), 0), box.preset.tareWeightLb),
      lengthIn: box.preset.lengthIn,
      widthIn: box.preset.widthIn,
      heightIn: box.preset.heightIn,
      items: box.units.map((unit) => unit.item),
      estimatedBox: Boolean(box.preset.estimated),
      boxId: box.preset.id,
      boxName: box.preset.name,
      unknownItemDimensions: box.units.some((unit) => unit.unknownDims),
    })),
  };
}

export function describePackedParcels(parcels: PackedParcel[]) {
  return parcels.map((parcel) => ({
    boxId: parcel.boxId ?? null,
    boxName: parcel.boxName ?? null,
    estimatedBox: Boolean(parcel.estimatedBox),
    weightLb: parcel.weightLb,
    lengthIn: parcel.lengthIn,
    widthIn: parcel.widthIn,
    heightIn: parcel.heightIn,
    unknownItemDimensions: Boolean(parcel.unknownItemDimensions),
    items: parcel.items.map((item) => item.description),
  }));
}

export function resolveCartParcel(input: {
  products: CartParcelProduct[];
  packages?: ShippingPackagePreset[];
  defaultPackageId?: string | null;
  categoryDefaults?: Record<string, CategoryShippingDefault>;
  useEstimatedPresets?: boolean;
}) {
  const packages = input.packages ?? [];
  const useEstimatedPresets = input.useEstimatedPresets !== false;
  const parcels: PackedParcel[] = [];
  const reviews: ShippingReviewItem[] = [];
  const boxUnits: PackUnit[] = [];
  let missing = 0;
  let code: ParcelFailureCode | undefined;

  for (const product of input.products) {
    const qty = Number(product.quantity);
    const preferred = packageFromProduct(product);
    const aiSource = isAiWeightSource(product.weight_source);
    const item = {
      description: lineDescription(product),
      quantity: Number.isFinite(qty) && qty > 0 ? qty : 1,
      price: product.price,
    };

    if (preferred && !aiSource) {
      const settings = sellingSettingsFromProduct(product);
      const unitCount = settings.sellingMethod === "weight" || product.weightOption ? 1 : Math.max(1, Math.round(qty));
      for (let index = 0; index < unitCount; index += 1) {
        parcels.push({
          weightLb: preferred.weightLb,
          lengthIn: preferred.lengthIn,
          widthIn: preferred.widthIn,
          heightIn: preferred.heightIn,
          items: [{ ...item, quantity: settings.sellingMethod === "weight" || product.weightOption ? item.quantity : 1 }],
          estimatedBox: false,
          unknownItemDimensions: false,
        });
      }
      continue;
    }

    const weight = lineItemWeightLb(product, input.categoryDefaults);
    if (!weight) {
      missing += 1;
      if (!code) code = "missing_weight";
      reviews.push({
        name: lineDescription(product),
        source: product.weight_source ?? "missing",
        reason: "Missing verified shipping weight and no configured category estimate.",
      });
      continue;
    }
    if (weight.estimated || weight.review) {
      reviews.push({
        name: lineDescription(product),
        source: weight.source,
        reason: weight.review ?? "Estimated weight used for quoting. Verify before treating as measured.",
      });
    }

    const lengthIn = parsePositive(product.ship_length_in);
    const widthIn = parsePositive(product.ship_width_in);
    const heightIn = parsePositive(product.ship_height_in);
    const dims = parseDims(product.dims) ?? (lengthIn && widthIn && heightIn ? { lengthIn, widthIn, heightIn } : null);
    const unknownDims = !dims;
    if (unknownDims) {
      reviews.push({
        name: lineDescription(product),
        source: weight.source,
        reason: "Unknown item dimensions. Box chosen by weight only; this does not prove the product fits.",
      });
    }

    const assignedId = String(product.shipping_package_id ?? "").trim() || input.defaultPackageId || "";
    const settings = sellingSettingsFromProduct(product);
    const packUnit = {
      alreadyBuffered: weight.alreadyBuffered,
      estimatedWeight: weight.estimated,
      unknownDims,
    };
    if (settings.sellingMethod === "weight" || product.weightOption) {
      boxUnits.push({ weightLb: weight.weightLb, dims, assignedId, item, ...packUnit });
      continue;
    }
    const unitCount = Math.max(1, Math.round(qty));
    const unitWeight = Number((weight.weightLb / unitCount).toFixed(3));
    for (let index = 0; index < unitCount; index += 1) {
      boxUnits.push({
        weightLb: unitWeight,
        dims,
        assignedId,
        item: { ...item, quantity: 1 },
        ...packUnit,
      });
    }
  }

  if (!missing && boxUnits.length) {
    const packed = packUnitsIntoBoxes(boxUnits, packages, useEstimatedPresets);
    if ("code" in packed) {
      missing += 1;
      code = packed.code;
    } else {
      parcels.push(...packed.parcels);
      if (packed.parcels.some((parcel) => parcel.estimatedBox)) {
        reviews.push({
          name: "packaging",
          source: "estimated_box",
          reason: "Estimated packaging preset used. This is not a measured or carrier-approved carton.",
        });
      }
    }
  }

  const usedEstimatedWeight = reviews.some((row) => row.source === "category_estimate" || isAiWeightSource(row.source));
  const usedEstimatedBox = parcels.some((parcel) => parcel.estimatedBox) || reviews.some((row) => row.source === "estimated_box");

  if (missing) {
    return {
      parcel: null,
      parcels: [] as PackedParcel[],
      missing,
      counted: 0,
      reviews,
      usedEstimatedWeight,
      usedEstimatedBox: false,
      code: code ?? "missing_parcel",
      message: parcelFailureMessage(code ?? "missing_parcel"),
    };
  }

  const totalWeightLb = Number(parcels.reduce((sum, parcel) => sum + parcel.weightLb, 0).toFixed(3));
  return {
    parcel: parcels.length === 1 ? parcels[0] : parcels[0] ?? null,
    parcels,
    totalWeightLb,
    missing: 0,
    counted: parcels.length,
    reviews,
    usedEstimatedWeight,
    usedEstimatedBox,
  };
}
