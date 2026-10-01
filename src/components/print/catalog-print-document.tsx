import { money } from "@/src/lib/print/kinds";
import { PrintToolbar } from "@/src/components/print/print-toolbar";
import { catalogPrintTitle, type CatalogPrintKind } from "@/src/lib/print/kinds";
import { isLowStock } from "@/src/lib/catalog/low-stock";

export type PrintProduct = {
  name: string;
  sku?: string | null;
  price?: number | string | null;
  is_active?: boolean | null;
  stock_quantity?: number | string | null;
  track_inventory?: boolean | null;
  ship_weight_lb?: number | string | null;
  categories?: { name?: string | null } | { name?: string | null }[] | null;
};

function categoryName(product: PrintProduct) {
  const categories = product.categories;
  if (Array.isArray(categories)) return categories[0]?.name ?? "";
  return categories?.name ?? "";
}

export function CatalogPrintDocument({ kind, products }: { kind: CatalogPrintKind; products: PrintProduct[] }) {
  const title = catalogPrintTitle(kind);
  return (
    <article className="print-sheet mx-auto max-w-5xl bg-white p-6 text-black sm:p-8">
      <PrintToolbar title={`Ivoire Shop · ${title}`} />
      <header className="border-b border-black pb-4">
        <p className="text-xs uppercase tracking-[0.24em]">Ivoire Shop</p>
        <h1 className="mt-2 text-3xl font-semibold">{title}</h1>
        <p className="mt-2 text-sm">{products.length} product{products.length === 1 ? "" : "s"}</p>
      </header>
      <div className="mt-6 space-y-4 sm:hidden print:hidden">
        {products.map((product, index) => {
          const tracked = product.track_inventory !== false;
          const stock = product.stock_quantity;
          const status = kind === "products"
            ? (product.is_active ? "Active" : "Inactive")
            : !tracked
              ? "Not tracked"
              : Number(stock) === 0
                ? "Out of stock"
                : isLowStock(true, stock)
                  ? "Low stock"
                  : product.is_active
                    ? "Active"
                    : "Inactive";
          return (
            <article className="rounded-xl border border-black/20 p-4 text-sm" key={`card-${product.sku ?? product.name}-${index}`}>
              <p className="font-semibold">{product.name}</p>
              <p className="mt-1 break-all">SKU: {product.sku || "—"}</p>
              <p>Category: {categoryName(product) || "—"}</p>
              {kind === "products" ? <p>Price: {product.price == null ? "—" : money(product.price)}</p> : <p>Stock: {tracked ? String(stock ?? "—") : "—"}</p>}
              <p>Status: {status}</p>
            </article>
          );
        })}
      </div>
      <div className="mt-6 hidden overflow-x-auto sm:block print:block">
        <table className="w-full border-collapse text-left text-sm">
          <thead>
            <tr className="border-b border-black">
              <th className="py-2 pr-3">Product</th>
              <th className="py-2 pr-3">SKU</th>
              <th className="py-2 pr-3">Category</th>
              {kind === "products" ? <th className="py-2 pr-3 text-right">Price</th> : null}
              {kind !== "products" ? <th className="py-2 pr-3 text-right">Stock</th> : null}
              <th className="py-2">Status</th>
            </tr>
          </thead>
          <tbody>
            {products.map((product, index) => {
              const tracked = product.track_inventory !== false;
              const stock = product.stock_quantity;
              const status = !tracked
                ? "Not tracked"
                : Number(stock) === 0
                  ? "Out of stock"
                  : isLowStock(true, stock)
                    ? "Low stock"
                    : product.is_active
                      ? "Active"
                      : "Inactive";
              return (
                <tr className="border-b border-black/20" key={`${product.sku ?? product.name}-${index}`}>
                  <td className="py-3 pr-3 break-words">{product.name}</td>
                  <td className="py-3 pr-3 break-all">{product.sku || "—"}</td>
                  <td className="py-3 pr-3">{categoryName(product) || "—"}</td>
                  {kind === "products" ? <td className="py-3 pr-3 text-right">{product.price == null ? "—" : money(product.price)}</td> : null}
                  {kind !== "products" ? <td className="py-3 pr-3 text-right">{tracked ? String(stock ?? "—") : "—"}</td> : null}
                  <td className="py-3">{kind === "products" ? (product.is_active ? "Active" : "Inactive") : status}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="mt-10 text-xs">Ivoire Shop · Printed {new Date().toLocaleString()}</p>
    </article>
  );
}
