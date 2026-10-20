import Image from "next/image";
import Link from "next/link";
import { OwnersManualPrintButton } from "@/src/components/admin/owners-manual-print-button";
import { requireAdmin } from "@/src/lib/auth/guards";
import {
  MANUAL_STATUS_LABEL,
  OWNERS_MANUAL_PAGES,
  manualTocEntries,
} from "@/src/lib/admin/owners-manual-content";

export default async function OwnersManualPrintPage() {
  await requireAdmin();
  const toc = manualTocEntries();

  return (
    <div className="mx-auto max-w-3xl bg-white px-6 py-8 text-[#173f35] print:px-0">
      <div className="mb-6 flex flex-wrap gap-3 print:hidden">
        <OwnersManualPrintButton />
        <Link className="min-h-11 rounded-xl border border-[#173f35]/20 px-4 py-2 text-sm font-semibold" href="/admin/settings/owners-manual">
          Back to interactive book
        </Link>
      </div>
      <header className="mb-8 flex items-center gap-4 border-b border-[#173f35]/15 pb-6">
        <Image alt="BADGER GHOST logo" height={72} src="/brand/badger-ghost-logo.jpg" width={72} />
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[#b8964c]">BADGER GHOST</p>
          <h1 className="text-3xl font-semibold">Ivoire Shop Owner&apos;s Playbook</h1>
          <p className="mt-1 text-sm text-[#6b6b6b]">Printable edition · Prepared by BADGER GHOST</p>
        </div>
      </header>

      <section className="mb-8">
        <h2 className="text-xl font-semibold">Contents</h2>
        <ol className="mt-3 list-decimal space-y-1 pl-5 text-sm">
          {toc.map((entry) => (
            <li key={entry.id}>{entry.label}</li>
          ))}
        </ol>
      </section>

      {OWNERS_MANUAL_PAGES.map((page) => (
        <section className="mb-8 break-inside-avoid border-t border-[#173f35]/10 pt-6" key={page.id}>
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#b8964c]">
            {page.kind === "cover" || page.kind === "credits" || page.kind === "toc" ? page.chapter : `Chapter ${page.chapter}`}
          </p>
          <h2 className="mt-2 text-2xl font-semibold">{page.title}</h2>
          {page.status ? <p className="mt-2 text-sm font-medium text-[#7c5d1a]">{MANUAL_STATUS_LABEL[page.status]}</p> : null}
          <div className="mt-3 space-y-2 text-sm leading-6">
            {page.body.map((paragraph) => (
              <p key={paragraph}>{paragraph}</p>
            ))}
          </div>
          {page.steps?.length ? (
            <ol className="mt-3 list-decimal space-y-1 pl-5 text-sm">
              {page.steps.map((step) => (
                <li key={step}>{step}</li>
              ))}
            </ol>
          ) : null}
          {page.tips?.length ? (
            <ul className="mt-3 space-y-1 text-sm">
              {page.tips.map((tip) => (
                <li key={tip}>• {tip}</li>
              ))}
            </ul>
          ) : null}
          {page.links?.length ? (
            <p className="mt-3 text-xs text-[#6b6b6b]">
              Links: {page.links.map((link) => `${link.label} (${link.href})`).join(" · ")}
            </p>
          ) : null}
        </section>
      ))}
    </div>
  );
}
