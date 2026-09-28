"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import {
  clearAllPricesAction,
  freshCatalogResetAction,
  restoreLastCatalogSnapshotAction,
  unlistAllProductsAction,
} from "@/src/lib/catalog/catalog-reset-actions";
import {
  CLEAR_PRICES_CONFIRMATION,
  CLEAR_PRICES_PHRASE,
  confirmationMatches,
  formatCatalogImpact,
  FRESH_RESET_EFFECTS,
  FRESH_START_PHRASE,
  RESTORE_PHRASE,
  UNLIST_CONFIRMATION,
  type CatalogImpact,
  type CatalogSnapshotMeta,
} from "@/src/lib/catalog/catalog-reset";

function ImpactList({ impact }: { impact: CatalogImpact }) {
  return (
    <ul className="mt-3 grid gap-2 sm:grid-cols-2">
      {formatCatalogImpact(impact).map((line) => (
        <li className="rounded-xl bg-[#f9f7f3] px-4 py-3 text-sm text-[#173f35]" key={line}>
          {line}
        </li>
      ))}
    </ul>
  );
}

function ConfirmDialog({
  title,
  children,
  onClose,
}: {
  title: string;
  children: React.ReactNode;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-40 flex items-end justify-center bg-black/40 p-4 sm:items-center">
      <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-[#173f35]/15 bg-white p-5 shadow-[0_20px_50px_rgba(23,63,53,0.18)]" role="dialog" aria-modal="true" aria-labelledby="catalog-confirm-title">
        <h2 className="text-xl font-semibold text-[#173f35]" id="catalog-confirm-title">
          {title}
        </h2>
        {children}
        <button className="mt-4 min-h-11 text-sm font-semibold text-[#173f35] underline underline-offset-4" onClick={onClose} type="button">
          Cancel
        </button>
      </div>
    </div>
  );
}

export function CatalogControlsPanel({
  impact,
  snapshot,
}: {
  impact: CatalogImpact;
  snapshot: CatalogSnapshotMeta | null;
}) {
  const router = useRouter();
  const [dialog, setDialog] = useState<"unlist" | "clear" | "fresh" | "restore" | null>(null);
  const [phrase, setPhrase] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  function closeDialog() {
    if (busy) return;
    setDialog(null);
    setPhrase("");
  }

  async function runUnlist() {
    setBusy(true);
    setError(null);
    const result = await unlistAllProductsAction(true);
    setBusy(false);
    if (!result.success) {
      setError(result.error);
      return;
    }
    setDialog(null);
    setMessage(`${result.updated} products unlisted from the customer store.`);
    router.refresh();
  }

  async function runClear() {
    if (!confirmationMatches(phrase, CLEAR_PRICES_PHRASE)) {
      setError("Type CLEAR PRICES to confirm.");
      return;
    }
    setBusy(true);
    setError(null);
    const result = await clearAllPricesAction(phrase);
    setBusy(false);
    if (!result.success) {
      setError(result.error);
      return;
    }
    setDialog(null);
    setPhrase("");
    setMessage(`Prices cleared on ${result.updated} products.`);
    router.refresh();
  }

  async function runFresh() {
    if (!confirmationMatches(phrase, FRESH_START_PHRASE)) {
      setError("Type FRESH START to confirm.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const result = await freshCatalogResetAction(phrase, true);
      setBusy(false);
      if (result && !result.success) setError(result.error);
    } catch (caught) {
      setBusy(false);
      const digest = typeof caught === "object" && caught && "digest" in caught ? String((caught as { digest?: string }).digest) : "";
      if (digest.startsWith("NEXT_REDIRECT")) return;
      setError("Catalog reset could not finish. Nothing was changed.");
    }
  }

  async function runRestore() {
    if (!confirmationMatches(phrase, RESTORE_PHRASE)) {
      setError("Type RESTORE to confirm.");
      return;
    }
    setBusy(true);
    setError(null);
    const result = await restoreLastCatalogSnapshotAction(phrase);
    setBusy(false);
    if (!result.success) {
      setError(result.error);
      return;
    }
    setDialog(null);
    setPhrase("");
    setMessage(`Restored catalog state for ${result.updated} products.`);
    router.refresh();
  }

  return (
    <div className="space-y-6">
      {error ? <p className="rounded-2xl border border-[#7f1d1d]/20 bg-[#7f1d1d]/5 px-4 py-3 text-sm text-[#7f1d1d]">{error}</p> : null}
      {message ? <p className="rounded-2xl border border-[#173f35]/15 bg-[#173f35]/5 px-4 py-3 text-sm text-[#173f35]">{message}</p> : null}

      <section className="rounded-2xl border border-[#173f35]/10 bg-white p-5">
        <h2 className="text-lg font-semibold text-[#173f35]">Current catalog</h2>
        <ImpactList impact={impact} />
      </section>

      <section className="rounded-2xl border border-[#173f35]/10 bg-white p-5">
        <h2 className="text-lg font-semibold text-[#173f35]">Unlist All Products</h2>
        <p className="mt-2 text-sm text-[#6b6b6b]">
          Hides every product from the customer store. Names, images, prices, SKUs, slugs, inventory, and category assignments stay in Admin.
          Coming Soon previews are also turned off so nothing leaks onto the storefront.
        </p>
        <button
          className="mt-4 min-h-11 rounded-xl border border-[#173f35]/20 bg-white px-4 py-2.5 text-sm font-semibold text-[#173f35]"
          onClick={() => {
            setError(null);
            setPhrase("");
            setDialog("unlist");
          }}
          type="button"
        >
          Unlist All Products
        </button>
      </section>

      <section className="rounded-2xl border border-[#173f35]/10 bg-white p-5">
        <h2 className="text-lg font-semibold text-[#173f35]">Clear All Prices</h2>
        <p className="mt-2 text-sm text-[#6b6b6b]">
          Sets every catalog price to blank (NULL), not 0.00. Products without prices are automatically unlisted. Everything else is preserved.
        </p>
        <button
          className="mt-4 min-h-11 rounded-xl border border-[#7c5d1a]/30 bg-[#b8964c]/10 px-4 py-2.5 text-sm font-semibold text-[#7c5d1a]"
          onClick={() => {
            setError(null);
            setPhrase("");
            setDialog("clear");
          }}
          type="button"
        >
          Clear All Prices
        </button>
      </section>

      <section className="rounded-2xl border border-[#7f1d1d]/15 bg-white p-5">
        <h2 className="text-lg font-semibold text-[#7f1d1d]">Fresh Catalog Reset</h2>
        <p className="mt-2 text-sm text-[#6b6b6b]">
          Pre-delivery clean start: unlist every product, clear prices, turn off inventory tracking, and hide storefront merchandising flags. A lightweight snapshot is stored first so you can restore the previous catalog state.
        </p>
        <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-[#6b6b6b]">
          {FRESH_RESET_EFFECTS.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
        <button
          className="mt-4 min-h-11 rounded-xl bg-[#7f1d1d] px-4 py-2.5 text-sm font-semibold text-white"
          onClick={() => {
            setError(null);
            setPhrase("");
            setDialog("fresh");
          }}
          type="button"
        >
          Fresh Catalog Reset
        </button>
      </section>

      <section className="rounded-2xl border border-[#173f35]/10 bg-white p-5">
        <h2 className="text-lg font-semibold text-[#173f35]">Restore Last Catalog Snapshot</h2>
        {snapshot ? (
          <p className="mt-2 text-sm text-[#6b6b6b]">
            Last snapshot: {snapshot.itemCount} products on {snapshot.createdAt.slice(0, 16).replace("T", " ")} UTC. This restores previous prices, listing, inventory, and merchandising flags. It does not delete products or images.
          </p>
        ) : (
          <p className="mt-2 text-sm text-[#6b6b6b]">No snapshot yet. One is created automatically when Fresh Catalog Reset runs.</p>
        )}
        <button
          className="mt-4 min-h-11 rounded-xl border border-[#173f35]/20 bg-white px-4 py-2.5 text-sm font-semibold text-[#173f35] disabled:opacity-50"
          disabled={!snapshot}
          onClick={() => {
            setError(null);
            setPhrase("");
            setDialog("restore");
          }}
          type="button"
        >
          Restore Last Catalog Snapshot
        </button>
      </section>

      {dialog === "unlist" ? (
        <ConfirmDialog onClose={closeDialog} title="Unlist all products">
          <p className="mt-3 text-sm text-[#173f35]">{UNLIST_CONFIRMATION}</p>
          <ImpactList impact={impact} />
          <p className="mt-2 text-sm text-[#6b6b6b]">{impact.total} products will remain in Admin under Foods, Cosmetics, and Ivoire Market.</p>
          <button className="mt-4 min-h-11 w-full rounded-xl bg-[#173f35] px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-60" disabled={busy} onClick={() => void runUnlist()} type="button">
            {busy ? "Unlisting..." : "Unlist All Products"}
          </button>
        </ConfirmDialog>
      ) : null}

      {dialog === "clear" ? (
        <ConfirmDialog onClose={closeDialog} title="Clear all prices">
          <p className="mt-3 text-sm text-[#173f35]">{CLEAR_PRICES_CONFIRMATION}</p>
          <ImpactList impact={impact} />
          <p className="mt-2 text-sm text-[#6b6b6b]">Type {CLEAR_PRICES_PHRASE} to continue. Prices become blank, not 0.00.</p>
          <input
            aria-label="Type CLEAR PRICES to confirm"
            autoCapitalize="characters"
            className="mt-3 min-h-11 w-full rounded-xl border border-[#173f35]/15 px-4 py-2.5 text-sm text-[#173f35]"
            onChange={(event) => setPhrase(event.target.value)}
            value={phrase}
          />
          <button
            className="mt-4 min-h-11 w-full rounded-xl bg-[#7c5d1a] px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-60"
            disabled={busy || !confirmationMatches(phrase, CLEAR_PRICES_PHRASE)}
            onClick={() => void runClear()}
            type="button"
          >
            {busy ? "Clearing..." : "Clear All Prices"}
          </button>
        </ConfirmDialog>
      ) : null}

      {dialog === "fresh" ? (
        <ConfirmDialog onClose={closeDialog} title="Fresh Catalog Reset">
          <p className="mt-3 text-sm text-[#173f35]">This is the pre-delivery clean-start operation.</p>
          <ImpactList impact={impact} />
          <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-[#6b6b6b]">
            {FRESH_RESET_EFFECTS.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
          <p className="mt-3 text-sm text-[#6b6b6b]">Type {FRESH_START_PHRASE}, then press Reset Catalog.</p>
          <input
            aria-label="Type FRESH START to confirm"
            autoCapitalize="characters"
            className="mt-3 min-h-11 w-full rounded-xl border border-[#173f35]/15 px-4 py-2.5 text-sm text-[#173f35]"
            onChange={(event) => setPhrase(event.target.value)}
            value={phrase}
          />
          <button
            className="mt-4 min-h-11 w-full rounded-xl bg-[#7f1d1d] px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-60"
            disabled={busy || !confirmationMatches(phrase, FRESH_START_PHRASE)}
            onClick={() => void runFresh()}
            type="button"
          >
            {busy ? "Resetting..." : "Reset Catalog"}
          </button>
        </ConfirmDialog>
      ) : null}

      {dialog === "restore" ? (
        <ConfirmDialog onClose={closeDialog} title="Restore last snapshot">
          <p className="mt-3 text-sm text-[#173f35]">Restore the previous catalog listing, prices, inventory flags, and merchandising state?</p>
          <ImpactList impact={impact} />
          <p className="mt-2 text-sm text-[#6b6b6b]">Type {RESTORE_PHRASE} to continue. Products and images are not deleted.</p>
          <input
            aria-label="Type RESTORE to confirm"
            autoCapitalize="characters"
            className="mt-3 min-h-11 w-full rounded-xl border border-[#173f35]/15 px-4 py-2.5 text-sm text-[#173f35]"
            onChange={(event) => setPhrase(event.target.value)}
            value={phrase}
          />
          <button
            className="mt-4 min-h-11 w-full rounded-xl bg-[#173f35] px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-60"
            disabled={busy || !confirmationMatches(phrase, RESTORE_PHRASE)}
            onClick={() => void runRestore()}
            type="button"
          >
            {busy ? "Restoring..." : "Restore Last Catalog Snapshot"}
          </button>
        </ConfirmDialog>
      ) : null}
    </div>
  );
}
