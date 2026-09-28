import Link from "next/link";
import { CATALOG_PREPARING_BODY, CATALOG_PREPARING_TITLE } from "@/src/lib/catalog/catalog-reset";

export function CatalogPreparingNotice({ compact = false }: { compact?: boolean }) {
  return (
    <div className={compact ? "rounded-2xl border border-forest-green/10 bg-[#fffdf9] px-5 py-8 text-center" : "py-24 text-center"}>
      <h2 className="text-2xl font-semibold text-forest-green">{CATALOG_PREPARING_TITLE}</h2>
      <p className="mt-3 text-muted">{CATALOG_PREPARING_BODY}</p>
      {!compact ? (
        <Link className="mt-6 inline-flex min-h-11 items-center rounded-lg bg-forest-green px-5 py-3 text-sm font-semibold text-white" href="/">
          Back to home
        </Link>
      ) : null}
    </div>
  );
}
