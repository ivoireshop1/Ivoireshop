"use client";

import { useActionState } from "react";
import { requestShippoTestQuote, type ShippoTestQuoteResult } from "@/src/lib/delivery/actions";
import { SHIPPO_TEST_QUOTE_CONFIRM } from "@/src/lib/shipping/shippo-test-quote";
import { STEEL_SIX_SHIPPO_DESTINATION } from "@/src/lib/shipping/steel-six-cart";

export function ShippoTestQuoteForm({
  originComplete,
  originLines,
  shippoConfigured,
  shippoTest,
}: {
  originComplete: boolean;
  originLines: string[];
  shippoConfigured: boolean;
  shippoTest: boolean;
}) {
  const [state, action, pending] = useActionState(requestShippoTestQuote, null);
  return (
    <form action={action} className="min-w-0 space-y-4 overflow-x-hidden rounded-2xl bg-white p-5">
      <h2 className="font-semibold text-[#173f35]">Shippo TEST six-product quote</h2>
      <p className="text-sm text-[#6b6b6b]">
        Requests one quote-only Shippo TEST rates call for the six-product Steel cart. Automatic estimated parcels are used.
        Customer checkout stays on the current provider. Postage is not purchased. Sandbox prices are labeled TEST.
      </p>
      <p className="text-sm text-[#6b6b6b]">
        Origin: {originComplete ? originLines.join(", ") : "Store origin is incomplete. Save the Delivery origin first."}
      </p>
      <p className="text-sm text-[#6b6b6b]">
        Destination: {STEEL_SIX_SHIPPO_DESTINATION.name}, {STEEL_SIX_SHIPPO_DESTINATION.address_line_1}, {STEEL_SIX_SHIPPO_DESTINATION.city}, {STEEL_SIX_SHIPPO_DESTINATION.state} {STEEL_SIX_SHIPPO_DESTINATION.postal_code}
      </p>
      <p className="text-sm text-[#6b6b6b]">
        {shippoConfigured
          ? shippoTest
            ? "Shippo TEST token is configured on this server. Returned prices are sandbox test rates."
            : "A Shippo token is configured, but this Admin test stays closed unless it is a TEST token."
          : "SHIPPO_API_TOKEN is not configured on this environment."}
      </p>
      <label className="flex items-start gap-2 text-sm">
        <input className="mt-1" name="acknowledge" type="checkbox" />
        I understand this uses one Shippo TEST quote and does not buy a label or change checkout rates.
      </label>
      <label className="block text-sm">
        Type {SHIPPO_TEST_QUOTE_CONFIRM} to proceed
        <input className="mt-1 min-h-11 w-full rounded-xl border border-[#173f35]/15 px-3" name="confirm" />
      </label>
      {state?.error ? <p className="text-sm text-red-800">{state.error}</p> : null}
      {state?.requested ? <QuoteResult result={state} /> : null}
      <button className="min-h-11 rounded-xl bg-[#173f35] px-4 py-2 text-sm text-white disabled:opacity-70" disabled={pending || !originComplete || !shippoConfigured || !shippoTest} type="submit">
        {pending ? "Requesting one TEST quote…" : "Request one Shippo TEST quote"}
      </button>
    </form>
  );
}

function QuoteResult({ result }: { result: ShippoTestQuoteResult }) {
  return (
    <div className="space-y-2 rounded-xl border border-[#173f35]/10 bg-[#fbfaf7] p-3 text-sm text-[#173f35]">
      <p>API status: <strong>{result.status ?? 0}</strong> · Mode: {result.mode ?? "—"} · Label: TEST sandbox rates</p>
      <p>Customer-facing checkout rates required: no. Postage purchased: no. Provider setting unchanged.</p>
      {result.apiMessage ? <p>Sanitized API message: {result.apiMessage}</p> : null}
      {result.ok ? <p>UPS TEST services: {result.ups?.length ?? 0}. USPS TEST services: {result.usps?.length ?? 0}. Parcels: {result.parcelCount ?? 0}.</p> : null}
      {(result.ups ?? []).map((rate) => (
        <p key={`ups-${rate.service}-${rate.amount}`}>TEST · UPS · {rate.service} · ${rate.amount.toFixed(2)}{rate.estimatedDays != null ? ` · ${rate.estimatedDays} day(s)` : ""}</p>
      ))}
      {(result.usps ?? []).map((rate) => (
        <p key={`usps-${rate.service}-${rate.amount}`}>TEST · USPS · {rate.service} · ${rate.amount.toFixed(2)}{rate.estimatedDays != null ? ` · ${rate.estimatedDays} day(s)` : ""}</p>
      ))}
    </div>
  );
}
