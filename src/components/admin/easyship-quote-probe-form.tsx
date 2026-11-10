"use client";

import { useActionState } from "react";
import { requestEasyshipProductionQuote, type EasyshipQuoteProbeResult } from "@/src/lib/delivery/actions";
import { EASYSHIP_PRODUCTION_QUOTE_CONFIRM, STEEL_SIX_EASYSHIP_DESTINATION } from "@/src/lib/shipping/easyship-quote-probe";

export function EasyshipQuoteProbeForm({
  originComplete,
  originLines,
  easyshipConfigured,
  easyshipProduction,
  lines,
  missingPrices,
  parcels,
  packedError,
  declaredValue,
}: {
  originComplete: boolean;
  originLines: string[];
  easyshipConfigured: boolean;
  easyshipProduction: boolean;
  lines: Array<{ name: string; quantity: number; price: number | null }>;
  missingPrices: string[];
  parcels: EasyshipQuoteProbeResult["parcels"];
  packedError?: string | null;
  declaredValue: number | null;
}) {
  const [state, action, pending] = useActionState(requestEasyshipProductionQuote, null);
  const ready = originComplete && easyshipConfigured && !missingPrices.length && !packedError && (parcels?.length ?? 0) >= 1;
  return (
    <form action={action} className="min-w-0 space-y-4 overflow-x-hidden rounded-2xl bg-white p-5">
      <h2 className="font-semibold text-[#173f35]">Easyship production six-product quote</h2>
      <p className="text-sm text-[#6b6b6b]">
        Requests one quote-only Easyship Production rates call for the six-product Steel cart. Automatic two-parcel estimates and Steel catalog selling prices are used.
        Customer checkout rates stay off. Postage is not purchased. Sandbox rates are never shown as production prices.
      </p>
      <p className="text-sm text-[#6b6b6b]">
        Origin: {originComplete ? originLines.join(", ") : "Store origin is incomplete. Save the Delivery origin first."}
      </p>
      <p className="text-sm text-[#6b6b6b]">
        Destination: {STEEL_SIX_EASYSHIP_DESTINATION.address_line_1}, {STEEL_SIX_EASYSHIP_DESTINATION.city}, {STEEL_SIX_EASYSHIP_DESTINATION.state} {STEEL_SIX_EASYSHIP_DESTINATION.postal_code}
      </p>
      <p className="text-sm text-[#6b6b6b]">
        {easyshipConfigured
          ? easyshipProduction
            ? "Easyship Production key is configured. This button authorizes one rate-only Production call."
            : "An Easyship key is configured. Returned sandbox rates will be labeled sandbox and will not become checkout prices."
          : "EASYSHIP_API_KEY is not configured on this environment."}
      </p>
      <div className="space-y-1 text-sm text-[#173f35]">
        <p className="font-medium">Steel catalog lines</p>
        {lines.map((line) => (
          <p key={line.name}>
            {line.quantity} × {line.name}
            {line.price != null ? ` · $${line.price.toFixed(2)}` : " · selling price missing"}
          </p>
        ))}
        {declaredValue != null ? <p>Declared value from Steel prices: ${declaredValue.toFixed(2)}</p> : null}
        {missingPrices.length ? (
          <p className="text-[#7c5d1a]">Missing Steel selling prices: {missingPrices.join(", ")}. Prices are never invented.</p>
        ) : null}
      </div>
      <div className="space-y-1 text-sm text-[#173f35]">
        <p className="font-medium">Automatic parcel estimate</p>
        {packedError ? <p className="text-[#7c5d1a]">{packedError}</p> : null}
        {(parcels ?? []).map((parcel, index) => (
          <p key={`${parcel.boxId ?? "box"}-${index}`}>
            Parcel {index + 1}: {parcel.weightLb} lb · {parcel.lengthIn}×{parcel.widthIn}×{parcel.heightIn} in
            {parcel.boxName ? ` · ${parcel.boxName}` : ""}
            {parcel.estimatedBox ? " · estimated box" : ""}
          </p>
        ))}
      </div>
      <input name="confirm" type="hidden" value={EASYSHIP_PRODUCTION_QUOTE_CONFIRM} />
      {state?.error ? <p className="text-sm text-red-800">{state.error}</p> : null}
      {state?.requested ? <ProbeResult result={state} /> : null}
      <button className="min-h-11 rounded-xl bg-[#173f35] px-4 py-2 text-sm text-white disabled:opacity-70" disabled={pending || !ready} type="submit">
        {pending ? "Requesting one quote…" : "Request one Easyship production quote"}
      </button>
    </form>
  );
}

function ProbeResult({ result }: { result: EasyshipQuoteProbeResult }) {
  const sandbox = result.host === "sandbox" || result.mode === "sandbox";
  const label = sandbox ? "SANDBOX" : "PRODUCTION";
  return (
    <div className="space-y-2 rounded-xl border border-[#173f35]/10 bg-[#fbfaf7] p-3 text-sm text-[#173f35]">
      <p>API status: <strong>{result.status ?? 0}</strong> · Host: {result.host ?? "—"} · Mode: {result.mode ?? "—"} · Label: {label} rate-only</p>
      <p>Customer-facing checkout rates required: no. Postage purchased: no.</p>
      {result.declaredValue != null ? <p>Declared value from Steel prices: ${result.declaredValue.toFixed(2)}</p> : null}
      {result.apiMessage ? <p>Sanitized API message: {result.apiMessage}</p> : null}
      {(result.parcels ?? []).map((parcel, index) => (
        <p key={`est-${parcel.boxId ?? index}`}>
          Estimate {index + 1}: {parcel.weightLb} lb · {parcel.lengthIn}×{parcel.widthIn}×{parcel.heightIn} in
          {parcel.boxName ? ` · ${parcel.boxName}` : ""}
        </p>
      ))}
      {result.ok ? <p>UPS services: {result.ups?.length ?? 0}. USPS services: {result.usps?.length ?? 0}. Parcels: {result.parcelCount ?? 0}.</p> : null}
      {(result.ups ?? []).map((rate) => (
        <p key={`ups-${rate.service}-${rate.amount}`}>
          {sandbox ? "SANDBOX · " : ""}UPS · {rate.service} · ${rate.amount.toFixed(2)}
          {rate.estimatedDays != null ? ` · ${rate.estimatedDays} day(s)` : ""}
        </p>
      ))}
      {(result.usps ?? []).map((rate) => (
        <p key={`usps-${rate.service}-${rate.amount}`}>
          {sandbox ? "SANDBOX · " : ""}USPS · {rate.service} · ${rate.amount.toFixed(2)}
          {rate.estimatedDays != null ? ` · ${rate.estimatedDays} day(s)` : ""}
        </p>
      ))}
    </div>
  );
}
