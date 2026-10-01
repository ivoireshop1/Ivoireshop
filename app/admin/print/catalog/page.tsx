import { notFound } from "next/navigation";
import { requireAdmin } from "@/src/lib/auth/guards";
import { isCatalogPrintKind } from "@/src/lib/print/kinds";
import { isLowStock } from "@/src/lib/catalog/low-stock";
import { CatalogPrintDocument } from "@/src/components/print/catalog-print-document";

export default async function AdminCatalogPrintPage({
  searchParams,
}: {
  searchParams: Promise<{ kind?: string }>;
}) {
  const { kind } = await searchParams;
  if (!isCatalogPrintKind(kind)) notFound();
  const { supabase } = await requireAdmin();
  const { data, error } = await supabase
    .from("products")
    .select("name, sku, price, is_active, stock_quantity, track_inventory, ship_weight_lb, categories(name)")
    .order("name");
  if (error) throw new Error("Unable to load catalog print data.");
  const products = (data ?? []).filter((product) => {
    if (kind === "low-stock") return isLowStock(product.track_inventory, product.stock_quantity);
    return true;
  });
  return <CatalogPrintDocument kind={kind} products={products} />;
}
