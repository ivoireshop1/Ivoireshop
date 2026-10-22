"use client";

import { useActionState, useState } from "react";
import { requestEasyshipProductionQuote, type EasyshipQuoteProbeResult } from "@/src/lib/delivery/actions";
import { EASYSHIP_PRODUCTION_QUOTE_CONFIRM } from "@/src/lib/shipping/easyship-quote-probe";
import type { ShippingPackagePreset } from "@/src/lib/shipping/packages";

export function EasyshipQuoteProbeForm({
  originComplete,
  originLines,
  packages,
}: {
  originComplete: boolean;
  originLines: string[];
  packages: ShippingPackagePreset[];
}) {
  const [state, action, pending] = useActionState(requestEasyshipProductionQuote, null);
  const [lengthIn, setLengthIn] = useState("");
  const [widthIn, setWidthIn] = useState("");
  const [heightIn, setHeightIn] = useState("");

  function applyPackage(packageId: string) {
    const preset = packages.find((row) => row.id === packageId);
    if (!preset) return;
    setLengthIn(String(preset.lengthIn));
    setWidthIn(String(preset.widthIn));
    setHeightIn(String(preset.heightIn));
  }

  return (
    <form action={action} className="min-w-0 space-y-4 overflow-x-hidden rounded-2xl bg-white p-5">
      <h2 className="font-semibold text-[#173f35]">Easyship production quote probe</h2>
      <p className="text-sm text-[#6b6b6b]">
        Requests one quote-only Easyship rates call. It does not enable customer-facing checkout rates, create a shipment, or buy postage.
        Enter verified measurements and a real destination. Nothing is invented. A two-minute cooldown prevents accidental repeat calls.
      </p>
      <p className="text-sm text-[#6b6b6b]">
        Origin: {originComplete ? originLines.join(", ") : "Store origin is incomplete. Save the Delivery origin first."}
      </p>
      {packages.length ? (
        <label className="block text-sm">
          Use a saved package for box dimensions
          <select
            className="mt-2 min-h-11 w-full rounded-xl border border-[#173f35]/15 px-3"
            defaultValue=""
            onChange={(event) => applyPackage(event.target.value)}
          >
            <option value="">Enter dimensions below</option>
            {packages.filter((row) => row.isActive).map((row) => (
              <option key={row.id} value={row.id}>{row.name}</option>
            ))}
          </select>
        </label>
      ) : (
        <p className="text-sm text-[#7c5d1a]">No package presets are saved yet. Enter a measured box below.</p>
      )}
      <div className="grid gap-3 sm:grid-cols-4">
        <label className="text-sm">Packed weight (lb)<input className="mt-1 min-h-11 w-full rounded-xl border border-[#173f35]/15 px-3" min="0" name="weight_lb" step="0.01" type="number" /></label>
        <label className="text-sm">Length (in)<input className="mt-1 min-h-11 w-full rounded-xl border border-[#173f35]/15 px-3" min="0" name="length_in" onChange={(event) => setLengthIn(event.target.value)} step="0.1" type="number" value={lengthIn} /></label>
        <label className="text-sm">Width (in)<input className="mt-1 min-h-11 w-full rounded-xl border border-[#173f35]/15 px-3" min="0" name="width_in" onChange={(event) => setWidthIn(event.target.value)} step="0.1" type="number" value={widthIn} /></label>
        <label className="text-sm">Height (in)<input className="mt-1 min-h-11 w-full rounded-xl border border-[#173f35]/15 px-3" min="0" name="height_in" onChange={(event) => setHeightIn(event.target.value)} step="0.1" type="number" value={heightIn} /></label>
      </div>
      <label className="block text-sm">
        Declared value (USD)
        <input className="mt-1 min-h-11 w-full rounded-xl border border-[#173f35]/15 px-3" min="0" name="declared_value" step="0.01" type="number" />
      </label>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="text-sm sm:col-span-2">Destination line 1<input className="mt-1 min-h-11 w-full rounded-xl border border-[#173f35]/15 px-3" name="dest_line_1" /></label>
        <label className="text-sm">City<input className="mt-1 min-h-11 w-full rounded-xl border border-[#173f35]/15 px-3" name="dest_city" /></label>
        <label className="text-sm">State<input className="mt-1 min-h-11 w-full rounded-xl border border-[#173f35]/15 px-3" name="dest_state" /></label>
        <label className="text-sm">ZIP<input className="mt-1 min-h-11 w-full rounded-xl border border-[#173f35]/15 px-3" name="dest_postal" /></label>
        <label className="text-sm">Country<input className="mt-1 min-h-11 w-full rounded-xl border border-[#173f35]/15 px-3" defaultValue="US" name="dest_country" /></label>
      </div>
      <label className="flex items-start gap-2 text-sm">
        <input className="mt-1" name="acknowledge" type="checkbox" />
        I understand this uses one Easyship production API call and does not buy a label.
      </label>
      <label className="block text-sm">
        Type {EASYSHIP_PRODUCTION_QUOTE_CONFIRM} to proceed
        <input className="mt-1 min-h-11 w-full rounded-xl border border-[#173f35]/15 px-3" name="confirm" />
      </label>
      {state?.error ? <p className="text-sm text-red-800">{state.error}</p> : null}
      {state?.requested ? <ProbeResult result={state} /> : null}
      <button className="min-h-11 rounded-xl bg-[#173f35] px-4 py-2 text-sm text-white disabled:opacity-70" disabled={pending || !originComplete} type="submit">
        {pending ? "Requesting one quote…" : "Request one Easyship production quote"}
      </button>
    </form>
  );
}

function ProbeResult({ result }: { result: EasyshipQuoteProbeResult }) {
  return (
    <div className="space-y-2 rounded-xl border border-[#173f35]/10 bg-[#fbfaf7] p-3 text-sm text-[#173f35]">
      <p>API status: <strong>{result.status ?? 0}</strong> · Host: {result.host ?? "—"} · Mode: {result.mode ?? "—"}</p>
      <p>Customer-facing checkout rates required: no. Postage purchased: no.</p>
      {result.apiMessage ? <p>Sanitized API message: {result.apiMessage}</p> : null}
      {result.ok ? <p>UPS services: {result.ups?.length ?? 0}. USPS services: {result.usps?.length ?? 0}.</p> : null}
      {(result.ups ?? []).map((rate) => (
        <p key={`ups-${rate.service}`}>UPS · {rate.service} · ${rate.amount.toFixed(2)}{rate.estimatedDays != null ? ` · ${rate.estimatedDays} day(s)` : ""}</p>
      ))}
      {(result.usps ?? []).map((rate) => (
        <p key={`usps-${rate.service}`}>USPS · {rate.service} · ${rate.amount.toFixed(2)}{rate.estimatedDays != null ? ` · ${rate.estimatedDays} day(s)` : ""}</p>
      ))}
    </div>
  );
}
