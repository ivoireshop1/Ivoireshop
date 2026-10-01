import Link from "next/link";
import { requireAdmin } from "@/src/lib/auth/guards";
import { catalogPrintTitle, CATALOG_PRINT_KINDS } from "@/src/lib/print/kinds";

export default async function AdminPrintingPage() {
  await requireAdmin();
  return (
    <div className="min-w-0 space-y-6 overflow-x-hidden">
      <div>
        <p className="text-[11px] font-medium uppercase tracking-[0.24em] text-[#b8964c]">Operations</p>
        <h1 className="mt-2 text-3xl font-semibold text-[#173f35]">Printing Center</h1>
        <p className="mt-2 max-w-2xl text-sm text-[#6b6b6b]">
          Generate printable packing slips, receipts, and inventory reports from live Ivoire Shop data. Use Print in the preview to open your device print dialog.
        </p>
      </div>
      <section className="rounded-2xl bg-white p-5">
        <h2 className="font-semibold text-[#173f35]">Orders</h2>
        <p className="mt-2 text-sm text-[#6b6b6b]">Open an order, choose a document, then print. Packing slips, receipts, summaries, and delivery sheets use stored order totals.</p>
        <Link className="mt-4 inline-flex min-h-11 items-center text-sm font-semibold text-[#173f35] underline" href="/admin/orders">
          Open orders
        </Link>
      </section>
      <section className="rounded-2xl bg-white p-5">
        <h2 className="font-semibold text-[#173f35]">Products / Inventory</h2>
        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          {CATALOG_PRINT_KINDS.map((kind) => (
            <Link
              className="min-h-11 rounded-xl border border-[#173f35]/15 px-4 py-3 text-sm font-medium text-[#173f35]"
              href={`/admin/print/catalog?kind=${kind}`}
              key={kind}
            >
              {catalogPrintTitle(kind)}
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
