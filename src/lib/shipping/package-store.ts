import { parseShippingPackage, type ShippingPackagePreset } from "./packages";

type PackageQueryClient = any;

export async function loadShippingPackages(supabase: PackageQueryClient): Promise<ShippingPackagePreset[]> {
  const { data, error } = await supabase
    .from("shipping_packages")
    .select("id, name, length_in, width_in, height_in, max_weight_lb, tare_weight_lb, is_active")
    .order("name");
  if (error) return [];
  return (data ?? []).map(parseShippingPackage).filter((row: ShippingPackagePreset | null): row is ShippingPackagePreset => Boolean(row));
}
