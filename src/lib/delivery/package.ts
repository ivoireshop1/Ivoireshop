export type PackageDims = {
  weightLb: number;
  lengthIn: number;
  widthIn: number;
  heightIn: number;
};

export function parsePositive(value: unknown) {
  if (value === null || value === undefined || value === "") return null;
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : null;
}

export function packageFromProduct(product: {
  ship_weight_lb?: number | string | null;
  ship_length_in?: number | string | null;
  ship_width_in?: number | string | null;
  ship_height_in?: number | string | null;
}): PackageDims | null {
  const weightLb = parsePositive(product.ship_weight_lb);
  const lengthIn = parsePositive(product.ship_length_in);
  const widthIn = parsePositive(product.ship_width_in);
  const heightIn = parsePositive(product.ship_height_in);
  if (!weightLb || !lengthIn || !widthIn || !heightIn) return null;
  return { weightLb, lengthIn, widthIn, heightIn };
}

export function combinePackages(packages: PackageDims[]) {
  if (!packages.length) return null;
  return packages.reduce(
    (sum, item) => ({
      weightLb: sum.weightLb + item.weightLb,
      lengthIn: Math.max(sum.lengthIn, item.lengthIn),
      widthIn: Math.max(sum.widthIn, item.widthIn),
      heightIn: sum.heightIn + item.heightIn,
    }),
    { weightLb: 0, lengthIn: 0, widthIn: 0, heightIn: 0 },
  );
}

export function isShippingReady(product: Parameters<typeof packageFromProduct>[0]) {
  return Boolean(packageFromProduct(product));
}
