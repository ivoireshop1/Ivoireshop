import { CatalogPreparingNotice } from "@/src/components/storefront/catalog-preparing-notice";
import { getProducts } from "@/src/lib/catalog/catalog";

export async function CatalogEmptyHome() {
  let products: Awaited<ReturnType<typeof getProducts>> = [];
  try {
    products = await getProducts();
  } catch {
    products = [];
  }
  if (products.length) return null;
  return (
    <section className="mx-auto max-w-7xl px-5 py-8 lg:px-8">
      <CatalogPreparingNotice compact />
    </section>
  );
}
