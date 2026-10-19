"use client";

import Image from "next/image";
import Link from "next/link";
import { useDeferredValue, useMemo, useState } from "react";
import {
  MANUAL_STATUS_LABEL,
  OWNERS_MANUAL_PAGES,
  manualTocEntries,
  type ManualPage,
} from "@/src/lib/admin/owners-manual-content";

function pageMatches(page: ManualPage, query: string) {
  if (!query) return true;
  const blob = [
    page.chapter,
    page.title,
    page.kicker,
    ...(page.body ?? []),
    ...(page.steps ?? []),
    ...(page.tips ?? []),
    ...(page.links?.map((link) => link.label) ?? []),
  ]
    .join(" ")
    .toLowerCase();
  return blob.includes(query);
}

export function OwnersManual() {
  const [index, setIndex] = useState(0);
  const [query, setQuery] = useState("");
  const [flipping, setFlipping] = useState(false);
  const deferredQuery = useDeferredValue(query.trim().toLowerCase());
  const toc = useMemo(() => manualTocEntries(), []);

  const filteredIds = useMemo(() => {
    if (!deferredQuery) return OWNERS_MANUAL_PAGES.map((page) => page.id);
    return OWNERS_MANUAL_PAGES.filter((page) => pageMatches(page, deferredQuery)).map((page) => page.id);
  }, [deferredQuery]);

  const safeIndex = Math.min(index, OWNERS_MANUAL_PAGES.length - 1);
  const page = OWNERS_MANUAL_PAGES[safeIndex];
  const progress = ((safeIndex + 1) / OWNERS_MANUAL_PAGES.length) * 100;

  function goTo(next: number) {
    if (next < 0 || next >= OWNERS_MANUAL_PAGES.length || next === safeIndex) return;
    setFlipping(true);
    window.setTimeout(() => {
      setIndex(next);
      setFlipping(false);
    }, 220);
  }

  function jumpToId(id: string) {
    const next = OWNERS_MANUAL_PAGES.findIndex((entry) => entry.id === id);
    if (next >= 0) goTo(next);
  }

  return (
    <div className="owners-manual mx-auto max-w-3xl print:max-w-none">
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3 print:hidden">
        <div>
          <p className="text-[11px] font-medium uppercase tracking-[0.22em] text-[#b8964c]">Ivoire Shop · BADGER GHOST</p>
          <h1 className="mt-1 text-2xl font-semibold text-[#173f35] sm:text-3xl">Owner&apos;s Playbook</h1>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            className="min-h-11 rounded-xl border border-[#173f35]/20 bg-white px-4 py-2 text-sm font-semibold text-[#173f35]"
            href="/admin/settings/owners-manual/print"
            target="_blank"
          >
            Print / download
          </Link>
          <Link className="min-h-11 rounded-xl bg-[#173f35] px-4 py-2 text-sm font-semibold text-white" href="/admin/settings">
            Back to Settings
          </Link>
        </div>
      </div>

      <label className="print:hidden mb-3 block">
        <span className="sr-only">Search manual</span>
        <input
          className="min-h-11 w-full rounded-2xl border border-[#173f35]/15 bg-white px-4 text-sm text-[#173f35]"
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search chapters, Stripe, Shippo, orders…"
          value={query}
        />
      </label>

      {deferredQuery ? (
        <div className="print:hidden mb-4 rounded-2xl border border-[#173f35]/10 bg-white p-3">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#6b6b6b]">Search results</p>
          <ul className="mt-2 flex flex-wrap gap-2">
            {filteredIds.map((id) => {
              const entry = toc.find((item) => item.id === id);
              if (!entry) return null;
              return (
                <li key={id}>
                  <button
                    className="rounded-full border border-[#173f35]/15 px-3 py-1.5 text-left text-sm text-[#173f35]"
                    onClick={() => jumpToId(id)}
                    type="button"
                  >
                    {entry.label}
                  </button>
                </li>
              );
            })}
            {!filteredIds.length ? <li className="text-sm text-[#6b6b6b]">No matching chapters.</li> : null}
          </ul>
        </div>
      ) : null}

      <div className="print:hidden mb-3 h-1 overflow-hidden rounded-full bg-[#173f35]/10">
        <div className="h-full bg-[#b8964c] transition-all duration-300" style={{ width: `${progress}%` }} />
      </div>
      <p className="print:hidden mb-4 text-xs font-medium text-[#6b6b6b]">
        Page {safeIndex + 1} of {OWNERS_MANUAL_PAGES.length}
      </p>

      <div className="grid gap-4 lg:grid-cols-[220px_minmax(0,1fr)]">
        <nav
          aria-label="Playbook table of contents"
          className="print:hidden max-h-[70vh] overflow-auto rounded-[24px] border border-[#173f35]/10 bg-white p-3 lg:sticky lg:top-4"
        >
          <p className="px-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-[#b8964c]">Contents</p>
          <ol className="mt-2 space-y-1">
            {toc.map((entry) => (
              <li key={entry.id}>
                <button
                  className={`w-full rounded-xl px-2 py-2 text-left text-sm ${
                    page.id === entry.id ? "bg-[#173f35]/10 font-semibold text-[#173f35]" : "text-[#173f35]/80"
                  }`}
                  onClick={() => jumpToId(entry.id)}
                  type="button"
                >
                  {entry.label}
                </button>
              </li>
            ))}
          </ol>
        </nav>

        <div className="[perspective:1400px]">
          <article
            className="relative min-h-[520px] origin-left overflow-hidden rounded-[28px] border border-[#173f35]/10 bg-[linear-gradient(155deg,#fffdf8_0%,#f4ebe0_52%,#e8dfd0_100%)] p-5 shadow-[0_28px_60px_rgba(23,63,53,0.14)] transition-transform duration-200 sm:p-8 lg:[transform:rotateY(-4deg)]"
            key={page.id}
            style={flipping ? { transform: "rotateY(-14deg) scale(0.985)" } : undefined}
          >
            <div className="pointer-events-none absolute inset-y-0 left-0 w-8 bg-[linear-gradient(90deg,rgba(23,63,53,0.1),transparent)]" />
            <div className="pointer-events-none absolute inset-y-8 right-3 w-px bg-[#173f35]/10" />

            {page.kind === "cover" || page.kind === "credits" ? (
              <div className="flex flex-col items-center text-center">
                <Image
                  alt="BADGER GHOST logo"
                  className="rounded-3xl border border-[#173f35]/10 object-cover shadow-lg"
                  height={160}
                  priority
                  src="/brand/badger-ghost-logo.jpg"
                  width={160}
                />
                <p className="mt-5 text-[11px] font-semibold uppercase tracking-[0.24em] text-[#b8964c]">
                  {page.kicker ?? "BADGER GHOST"}
                </p>
                <h2 className="mt-3 max-w-md text-3xl font-semibold leading-tight text-[#173f35] sm:text-4xl">{page.title}</h2>
                <p className="mt-2 text-sm font-medium text-[#173f35]/70">Primary brand: Ivoire Shop</p>
              </div>
            ) : (
              <>
                <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[#7c5d1a]">
                  {page.kind === "toc" ? "Contents" : `Chapter ${page.chapter}`}
                </p>
                <h2 className="mt-3 text-3xl font-semibold leading-tight text-[#173f35]">{page.title}</h2>
              </>
            )}

            {page.status ? (
              <p
                className={`mt-4 rounded-2xl px-3 py-2 text-sm font-medium ${
                  page.status === "awaiting_config"
                    ? "bg-[#f3efe9] text-[#7c5d1a]"
                    : page.status === "locked"
                      ? "bg-[#7f1d1d]/10 text-[#7f1d1d]"
                      : "bg-[#173f35]/5 text-[#173f35]"
                }`}
              >
                {MANUAL_STATUS_LABEL[page.status]}
              </p>
            ) : null}

            {page.kind === "toc" ? (
              <ol className="mt-6 space-y-2">
                {toc.map((entry, tocIndex) => (
                  <li key={entry.id}>
                    <button
                      className="flex w-full items-center justify-between gap-3 rounded-xl border border-[#173f35]/10 bg-white/70 px-3 py-2 text-left text-sm text-[#173f35]"
                      onClick={() => jumpToId(entry.id)}
                      type="button"
                    >
                      <span>{entry.label}</span>
                      <span className="text-[#6b6b6b]">{tocIndex + 1}</span>
                    </button>
                  </li>
                ))}
              </ol>
            ) : (
              <div className="mt-5 space-y-3 text-base leading-7 text-[#2f2a24]">
                {page.body.map((paragraph) => (
                  <p key={paragraph}>{paragraph}</p>
                ))}
              </div>
            )}

            {page.steps?.length ? (
              <ol className="mt-5 list-decimal space-y-2 pl-5 text-sm leading-6 text-[#173f35]">
                {page.steps.map((step) => (
                  <li key={step}>{step}</li>
                ))}
              </ol>
            ) : null}

            {page.tips?.length ? (
              <ul className="mt-5 space-y-2 rounded-2xl bg-[#173f35]/5 p-4 text-sm leading-6 text-[#173f35]">
                {page.tips.map((tip) => (
                  <li key={tip}>• {tip}</li>
                ))}
              </ul>
            ) : null}

            {page.figure ? (
              <figure className="mt-6 overflow-hidden rounded-2xl border border-[#173f35]/10 bg-white">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img alt={page.figure.alt} className="h-auto w-full" src={page.figure.src} />
                <figcaption className="px-3 py-2 text-xs text-[#6b6b6b]">{page.figure.caption}</figcaption>
              </figure>
            ) : null}

            {page.links?.length ? (
              <div className="print:hidden mt-6 flex flex-wrap gap-2">
                {page.links.map((link) => (
                  <Link
                    className="min-h-10 rounded-xl border border-[#173f35]/20 bg-white px-3 py-2 text-sm font-semibold text-[#173f35]"
                    href={link.href}
                    key={link.href + link.label}
                  >
                    {link.label}
                  </Link>
                ))}
              </div>
            ) : null}

            <p className="mt-8 text-[11px] uppercase tracking-[0.18em] text-[#6b6b6b]">Ivoire Shop · BADGER GHOST · Never BUBBA</p>
          </article>
        </div>
      </div>

      <div className="mt-5 grid grid-cols-2 gap-3 print:hidden">
        <button
          className="min-h-12 rounded-2xl border border-[#173f35]/20 bg-white px-4 text-sm font-semibold text-[#173f35] disabled:opacity-40"
          disabled={safeIndex === 0}
          onClick={() => goTo(safeIndex - 1)}
          type="button"
        >
          Previous page
        </button>
        <button
          className="min-h-12 rounded-2xl bg-[#173f35] px-4 text-sm font-semibold text-white disabled:opacity-40"
          disabled={safeIndex >= OWNERS_MANUAL_PAGES.length - 1}
          onClick={() => goTo(safeIndex + 1)}
          type="button"
        >
          Next page
        </button>
      </div>
    </div>
  );
}
