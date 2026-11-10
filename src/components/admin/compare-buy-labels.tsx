"use client";

import { useActionState, useMemo, useState } from "react";
import { useFormStatus } from "react-dom";
import {
  COMPARE_SELECT_CLASS,
  PIRATE_SHIP_URL,
  easyshipPurchaseReady,
  equivalentServiceKey,
  formatShippingAddress,
  fullOrderComparison,
  isLowestKnown,
  missingPackageDetails,
  nextCompareBoxId,
  packageCsv,
  parsePositive,
  quoteFingerprint,
  quotesAreStale,
  shipFromReady,
  type CompareBox,
  type CompareQuoteState,
  type CompareShipFrom,
  type LabelCarrier,
  type PostageQuote,
} from "@/src/lib/shipping/compare-labels";

type DraftBox = { id: string; weightLb: string; lengthIn: string; widthIn: string; heightIn: string };
type PirateEntry = { id: string; carrier: LabelCarrier | ""; service: string; postage: string; days: string };
type PurchaseState = { error?: string; purchased?: boolean };
type FormAction = (state: CompareQuoteState | null, formData: FormData) => Promise<CompareQuoteState>;
type PurchaseAction = (state: PurchaseState | null, formData: FormData) => Promise<PurchaseState>;

const SELECT_STYLE = `
@keyframes compare-select { from { box-shadow: 0 0 0 3px #b8964c; } to { box-shadow: 0 0 0 0 rgba(184, 150, 76, 0); } }
@media (prefers-reduced-motion: reduce) {
  .compare-selected { animation: none !important; }
}
`;

function money(value: number | null | undefined) {
  if (value == null || !Number.isFinite(value)) return "—";
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(value);
}

function estimate(days: number | null) {
  if (days == null) return "Estimate unavailable";
  return `${days} business day${days === 1 ? "" : "s"}`;
}

function RefreshButton({ disabled }: { disabled: boolean }) {
  const { pending } = useFormStatus();
  return (
    <button className="min-h-11 rounded-xl bg-[#173f35] px-4 text-sm font-semibold text-white disabled:opacity-50" disabled={disabled || pending} type="submit">
      {pending ? "Refreshing quotes…" : "Refresh quotes"}
    </button>
  );
}

function numericBoxes(drafts: DraftBox[]): CompareBox[] | null {
  const boxes: CompareBox[] = [];
  for (const draft of drafts) {
    const weightLb = parsePositive(draft.weightLb);
    const lengthIn = parsePositive(draft.lengthIn);
    const widthIn = parsePositive(draft.widthIn);
    const heightIn = parsePositive(draft.heightIn);
    if (weightLb == null || lengthIn == null || widthIn == null || heightIn == null) return null;
    boxes.push({ id: draft.id, weightLb, lengthIn, widthIn, heightIn });
  }
  return boxes;
}

function pirateQuotes(boxIds: string[], entries: Record<string, PirateEntry[]>): Array<{ boxId: string; quotes: PostageQuote[] }> {
  return boxIds.map((boxId) => ({
    boxId,
    quotes: (entries[boxId] ?? []).flatMap((entry) => {
      const postage = parsePositive(entry.postage);
      if ((entry.carrier !== "ups" && entry.carrier !== "usps") || !entry.service.trim() || postage == null) return [];
      const days = parsePositive(entry.days);
      return [{
        boxId,
        carrier: entry.carrier,
        service: entry.service.trim(),
        postage,
        days,
        courierServiceId: null,
      } satisfies PostageQuote];
    }),
  }));
}

export function CompareBuyLabels({
  orderId,
  destination,
  shipFrom,
  customerShipping,
  savedService,
  savedCourierServiceId,
  verifiedPurchaseAllowed,
  quoteAction,
  purchaseAction,
}: {
  orderId: string;
  destination: {
    name?: string | null;
    address_line_1?: string | null;
    address_line_2?: string | null;
    city?: string | null;
    state?: string | null;
    postal_code?: string | null;
    country?: string | null;
  };
  shipFrom: CompareShipFrom;
  customerShipping: number | null;
  savedService: string | null;
  savedCourierServiceId: string | null;
  verifiedPurchaseAllowed: boolean;
  quoteAction: FormAction;
  purchaseAction: PurchaseAction;
}) {
  const [quoteState, submitQuote] = useActionState(quoteAction, null as CompareQuoteState | null);
  const [purchaseState, submitPurchase] = useActionState<PurchaseState | null, FormData>(purchaseAction, null);
  const [origin, setOrigin] = useState(shipFrom);
  const [boxes, setBoxes] = useState<DraftBox[]>([{ id: "box-1", weightLb: "", lengthIn: "", widthIn: "", heightIn: "" }]);
  const [pirate, setPirate] = useState<Record<string, PirateEntry[]>>({});
  const [copied, setCopied] = useState(false);
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const packed = numericBoxes(boxes);
  const packageError = packed ? missingPackageDetails(packed) : "Enter the actual packed weight and dimensions for every box.";
  const originError = shipFromReady(origin);
  const fingerprint = packed && !originError ? quoteFingerprint(origin, packed) : "";
  const stale = Boolean(quoteState?.fingerprint) && quotesAreStale(quoteState?.fingerprint, fingerprint);
  const easyshipUnavailable = Boolean(quoteState?.unavailable) && !stale;
  const easyshipBoxes = !stale && quoteState?.boxes && quoteState.fingerprint === fingerprint ? quoteState.boxes : [];
  const pirateBoxes = packed && !stale ? pirateQuotes(packed.map((box) => box.id), pirate) : [];
  const comparison = useMemo(() => {
    if (!packed || stale || !quoteState?.fingerprint || quoteState.fingerprint !== fingerprint) return [];
    return fullOrderComparison({
      boxIds: packed.map((box) => box.id),
      easyship: easyshipUnavailable ? "unavailable" : easyshipBoxes,
      pirate: pirateBoxes,
    });
  }, [packed, stale, quoteState, fingerprint, easyshipUnavailable, easyshipBoxes, pirateBoxes]);
  const addressText = formatShippingAddress(destination);
  const selected = comparison.find((row) => row.key === selectedKey) ?? null;
  const selectedEasyship = selected?.easyshipTotal == null ? null : easyshipBoxes.flatMap((box) => box.quotes).find((quote) => equivalentServiceKey(quote.carrier, quote.service) === selected.key) ?? null;
  const purchaseReady = easyshipPurchaseReady({
    purchasesEnabled: verifiedPurchaseAllowed,
    verifiedUpsPurchase: verifiedPurchaseAllowed,
    selected: selectedEasyship && selected?.easyshipTotal != null ? { ...selectedEasyship, postage: selected.easyshipTotal } : null,
    savedService,
    savedCourierServiceId,
    boxCount: packed?.length ?? 0,
  });

  function invalidatePirate() {
    setPirate({});
    setSelectedKey(null);
  }

  function updateBox(id: string, field: keyof DraftBox, value: string) {
    setBoxes((current) => current.map((box) => box.id === id ? { ...box, [field]: value } : box));
    invalidatePirate();
  }

  function updatePirate(boxId: string, entryId: string, patch: Partial<PirateEntry>) {
    setPirate((current) => ({
      ...current,
      [boxId]: (current[boxId] ?? []).map((entry) => entry.id === entryId ? { ...entry, ...patch } : entry),
    }));
  }

  async function copyAddress() {
    await navigator.clipboard.writeText(addressText);
    setCopied(true);
  }

  function downloadCsv() {
    if (!packed) return;
    const blob = new Blob([packageCsv(packed, destination)], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "ivoire-package.csv";
    link.click();
    URL.revokeObjectURL(url);
  }

  return (
    <section className="rounded-2xl border border-[#173f35]/10 bg-white p-5" data-compare-panel="labels">
      <style>{SELECT_STYLE}</style>
      <h2 className="font-semibold text-[#173f35]">Compare & Buy Labels</h2>
      <p className="mt-2 text-sm text-[#6b6b6b]">Customer shipping charge stays {money(customerShipping)}. Choosing a quote, copying an address, or downloading a CSV does not change the order status.</p>
      <article className="mt-4 rounded-2xl border border-[#173f35]/15 p-4">
        <h3 className="font-semibold text-[#173f35]">Packed order</h3>
        <p className="mt-2 whitespace-pre-line text-sm text-[#173f35]">{addressText || "This order has no saved shipping address."}</p>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          {([
            ["name", "Ship-from name"],
            ["address_line_1", "Ship-from street"],
            ["city", "Ship-from city"],
            ["state", "Ship-from state"],
            ["postal_code", "Ship-from postal code"],
            ["country", "Ship-from country"],
          ] as const).map(([field, label]) => (
            <label className="block text-sm text-[#173f35]" key={field}>
              {label}
              <input className="mt-1 min-h-11 w-full rounded-xl border border-[#173f35]/20 px-3" onChange={(event) => { setOrigin((current) => ({ ...current, [field]: event.target.value })); invalidatePirate(); }} value={origin[field]} />
            </label>
          ))}
        </div>
        <div className="mt-4 space-y-3">
          {boxes.map((box, index) => (
            <fieldset className="rounded-xl bg-[#f7f4ee] p-3" key={box.id}>
              <legend className="px-1 text-sm font-semibold text-[#173f35]">Box {index + 1}</legend>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                {([
                  ["weightLb", "Weight (lb)"],
                  ["lengthIn", "Length (in)"],
                  ["widthIn", "Width (in)"],
                  ["heightIn", "Height (in)"],
                ] as const).map(([field, label]) => (
                  <label className="block text-sm" key={field}>
                    {label}
                    <input className="mt-1 min-h-11 w-full rounded-xl border border-[#173f35]/20 px-3" inputMode="decimal" onChange={(event) => updateBox(box.id, field, event.target.value)} value={box[field]} />
                  </label>
                ))}
              </div>
              {boxes.length > 1 ? (
                <button className="mt-2 min-h-11 text-sm font-semibold text-[#173f35] underline" onClick={() => { setBoxes((current) => current.filter((item) => item.id !== box.id)); invalidatePirate(); }} type="button">Remove box</button>
              ) : null}
            </fieldset>
          ))}
        </div>
        <button className="mt-3 min-h-11 rounded-xl border border-[#173f35]/20 px-4 text-sm font-semibold text-[#173f35]" onClick={() => { setBoxes((current) => [...current, { id: nextCompareBoxId(current.map((box) => box.id)), weightLb: "", lengthIn: "", widthIn: "", heightIn: "" }]); invalidatePirate(); }} type="button">Add box</button>
        {packageError || originError ? <p className="mt-3 text-sm text-[#7c5d1a]">{packageError || originError}</p> : null}
        {stale ? <p className="mt-3 rounded-xl bg-[#f3efe9] p-3 text-sm text-[#7c5d1a]">Package details changed. Refresh quotes before ranking them again.</p> : null}
        <form action={submitQuote} className="mt-4">
          <input name="order_id" type="hidden" value={orderId} />
          <input name="ship_from_name" type="hidden" value={origin.name} />
          <input name="ship_from_line1" type="hidden" value={origin.address_line_1} />
          <input name="ship_from_city" type="hidden" value={origin.city} />
          <input name="ship_from_state" type="hidden" value={origin.state} />
          <input name="ship_from_postal" type="hidden" value={origin.postal_code} />
          <input name="ship_from_country" type="hidden" value={origin.country} />
          <input name="boxes_json" type="hidden" value={JSON.stringify(packed ?? [])} />
          <RefreshButton disabled={Boolean(packageError || originError)} />
        </form>
        {quoteState?.error ? <p className="mt-3 text-sm text-red-800">{quoteState.error}</p> : null}
      </article>
      <div aria-hidden="true" className="mx-auto my-3 hidden h-6 w-px bg-[#173f35]/30 lg:block" />
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <article className="rounded-2xl border border-[#173f35]/15 p-4">
          <h3 className="font-semibold text-[#173f35]">Easyship</h3>
          <p className="mt-1 text-xs font-semibold uppercase tracking-wide text-[#b8964c]">Live quote</p>
          {easyshipUnavailable ? <p className="mt-3 rounded-xl bg-[#f3efe9] p-3 text-sm text-[#173f35]">Quote unavailable</p> : null}
          {!easyshipUnavailable && !easyshipBoxes.length ? <p className="mt-3 text-sm text-[#6b6b6b]">Refresh quotes to load UPS and USPS postage.</p> : null}
          {easyshipBoxes.map((box, index) => (
            <div className="mt-3" key={box.boxId}>
              <p className="text-sm font-semibold text-[#173f35]">Box {index + 1}</p>
              <ul className="mt-2 space-y-2">
                {box.quotes.map((quote) => {
                  const key = equivalentServiceKey(quote.carrier, quote.service);
                  const row = comparison.find((item) => item.key === key);
                  const lowest = isLowestKnown(quote.postage, row?.lowest ?? null) && packed?.length === 1;
                  return (
                    <li key={`${quote.carrier}-${quote.service}`}>
                      <button className={`min-h-11 w-full rounded-xl border px-3 py-2 text-left text-sm ${selectedKey === key ? COMPARE_SELECT_CLASS : "border-[#173f35]/15"} ${lowest ? "bg-[#f3efe9]" : ""}`} onClick={() => setSelectedKey(key)} type="button">
                        <span className="font-semibold">{quote.carrier.toUpperCase()} · {quote.service}</span>
                        <span className="mt-1 block">{money(quote.postage)} · {estimate(quote.days)}</span>
                        {lowest ? <span className="mt-1 block text-xs font-semibold uppercase tracking-wide text-[#173f35]">Lowest known total</span> : null}
                      </button>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
          {purchaseReady && selectedEasyship && selected?.easyshipTotal != null ? (
            <form action={submitPurchase} className="mt-4 space-y-3">
              <input name="order_id" type="hidden" value={orderId} />
              <input name="reviewed_amount" type="hidden" value={String(selected.easyshipTotal)} />
              <input name="reviewed_service_id" type="hidden" value={selectedEasyship.courierServiceId ?? ""} />
              <input name="retry_mode" type="hidden" value="same" />
              <p className="text-sm text-[#173f35]">Review the total {money(selected.easyshipTotal)} before buying this saved UPS service.</p>
              <label className="block text-sm text-[#173f35]">
                Type buy-reviewed-ups-label to confirm this exact postage purchase.
                <input autoComplete="off" className="mt-1 min-h-11 w-full rounded-xl border border-[#173f35]/20 px-3" name="confirm" required />
              </label>
              <label className="flex items-start gap-2 text-sm text-[#173f35]">
                <input className="mt-1" name="acknowledged" required type="checkbox" />
                I reviewed this total. Buy this label only.
              </label>
              <button className="min-h-11 rounded-xl bg-[#173f35] px-4 text-sm font-semibold text-white" type="submit">Buy this Easyship label</button>
              {purchaseState?.error ? <p className="text-sm text-red-800">{purchaseState.error}</p> : null}
              {purchaseState?.purchased ? <p className="text-sm text-[#173f35]">Easyship label purchased.</p> : null}
            </form>
          ) : (
            <p className="mt-4 text-sm text-[#6b6b6b]">Easyship purchase stays off unless the verified single-box UPS purchase flow is approved and that saved service is selected.</p>
          )}
        </article>
        <article className="rounded-2xl border border-[#173f35]/15 p-4">
          <h3 className="font-semibold text-[#173f35]">Pirate Ship</h3>
          <p className="mt-1 text-xs font-semibold uppercase tracking-wide text-[#b8964c]">Entered by staff</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <button className="min-h-11 rounded-xl border border-[#173f35]/20 px-3 text-sm font-semibold text-[#173f35]" onClick={copyAddress} type="button">{copied ? "Address copied" : "Copy shipping address"}</button>
            <button className="min-h-11 rounded-xl border border-[#173f35]/20 px-3 text-sm font-semibold text-[#173f35]" disabled={!packed} onClick={downloadCsv} type="button">Download package CSV</button>
            <a className="inline-flex min-h-11 items-center rounded-xl border border-[#173f35]/20 px-3 text-sm font-semibold text-[#173f35]" href={PIRATE_SHIP_URL} rel="noreferrer" target="_blank">Open Pirate Ship</a>
          </div>
          <p className="mt-3 text-sm text-[#6b6b6b]">Enter the carrier, service, and postage shown in Pirate Ship. Buy and print the label there.</p>
          {boxes.map((box, index) => (
            <fieldset className="mt-3 rounded-xl bg-[#f7f4ee] p-3" key={box.id}>
              <legend className="px-1 text-sm font-semibold text-[#173f35]">Box {index + 1}</legend>
              {(pirate[box.id] ?? []).map((entry) => (
                <div className="mt-2 grid gap-2 sm:grid-cols-4" key={entry.id}>
                  <label className="text-sm">Carrier
                    <select className="mt-1 min-h-11 w-full rounded-xl border border-[#173f35]/20 px-2" onChange={(event) => updatePirate(box.id, entry.id, { carrier: event.target.value as LabelCarrier | "" })} value={entry.carrier}>
                      <option value="">Choose</option>
                      <option value="ups">UPS</option>
                      <option value="usps">USPS</option>
                    </select>
                  </label>
                  <label className="text-sm">Service
                    <input className="mt-1 min-h-11 w-full rounded-xl border border-[#173f35]/20 px-3" onChange={(event) => updatePirate(box.id, entry.id, { service: event.target.value })} value={entry.service} />
                  </label>
                  <label className="text-sm">Postage
                    <input className="mt-1 min-h-11 w-full rounded-xl border border-[#173f35]/20 px-3" inputMode="decimal" onChange={(event) => updatePirate(box.id, entry.id, { postage: event.target.value })} value={entry.postage} />
                  </label>
                  <label className="text-sm">Days
                    <input className="mt-1 min-h-11 w-full rounded-xl border border-[#173f35]/20 px-3" inputMode="numeric" onChange={(event) => updatePirate(box.id, entry.id, { days: event.target.value })} value={entry.days} />
                  </label>
                </div>
              ))}
              <button className="mt-2 min-h-11 text-sm font-semibold text-[#173f35] underline" onClick={() => setPirate((current) => ({ ...current, [box.id]: [...(current[box.id] ?? []), { id: `${box.id}-${(current[box.id] ?? []).length + 1}`, carrier: "", service: "", postage: "", days: "" }] }))} type="button">Add Pirate Ship service</button>
            </fieldset>
          ))}
        </article>
      </div>
      {comparison.length && !stale ? (
        <div className="mt-4">
          <h3 className="text-sm font-semibold text-[#173f35]">Full order cost</h3>
          <ul className="mt-2 space-y-2">
            {comparison.map((row) => (
              <li className="rounded-xl border border-[#173f35]/10 px-3 py-2 text-sm" key={row.key}>
                <span className="font-semibold">{row.key.replace("::", " · ")}</span>
                <span className="mt-1 block">Easyship {row.easyshipTotal == null ? "not complete" : money(row.easyshipTotal)} · Pirate Ship {row.pirateTotal == null ? "not complete" : money(row.pirateTotal)}</span>
                {row.lowest != null ? <span className="mt-1 block text-xs font-semibold uppercase tracking-wide text-[#173f35]">Lowest known total {money(row.lowest)}</span> : null}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </section>
  );
}
