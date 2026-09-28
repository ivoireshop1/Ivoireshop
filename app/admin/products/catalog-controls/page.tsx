import Link from "next/link";
import { CatalogControlsPanel } from "@/src/components/admin/catalog-controls-panel";
import { loadCatalogControlState } from "@/src/lib/catalog/catalog-reset-actions";
import { pageMetadata } from "@/src/lib/page-metadata";

export const metadata = pageMetadata("Catalog Controls", "Admin catalog reset and pricing controls.", "/admin/products/catalog-controls", false);

export default async function CatalogControlsPage() {
  const { impact, snapshot } = await loadCatalogControlState();

  return (
    <div className="space-y-6">
      <div>
        <p className="text-[11px] font-medium uppercase tracking-[0.22em] text-[#b8964c]">Catalog</p>
        <h1 className="mt-2 text-3xl font-semibold text-[#173f35]">Catalog Reset &amp; Pricing</h1>
        <p className="mt-2 max-w-2xl text-sm text-[#6b6b6b]">
          Use these controls to temporarily remove products from the customer store while keeping the catalog organized for review and repricing.
        </p>
        <Link className="mt-3 inline-flex min-h-11 items-center text-sm font-semibold text-[#173f35] underline underline-offset-4" href="/admin/products">
          Back to products
        </Link>
      </div>
      <CatalogControlsPanel impact={impact} snapshot={snapshot} />
    </div>
  );
}
