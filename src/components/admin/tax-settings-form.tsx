"use client";

import { useActionState } from "react";
import { saveTaxSettings } from "@/src/lib/delivery/actions";
import { parseTaxMode, taxModeLabel } from "@/src/lib/tax/totals";

export function TaxSettingsForm({
  taxMode,
  taxRate,
  appliesToShipping,
  taxName,
}: {
  taxMode: string | null | undefined;
  taxRate: number | string | null | undefined;
  appliesToShipping: boolean;
  taxName: string | null | undefined;
}) {
  const [state, action] = useActionState(saveTaxSettings, null);
  const mode = parseTaxMode(taxMode);
  return (
    <form action={action} className="min-w-0 space-y-4 overflow-x-hidden rounded-2xl bg-white p-5">
      <h2 className="font-semibold text-[#173f35]">Tax</h2>
      <p className="text-sm font-medium text-[#173f35]">Status: {mode === "not_configured" ? "Tax configuration required" : taxModeLabel(mode)}</p>
      <p className="text-sm text-[#6b6b6b]">
        Choose a tax decision explicitly. Saving a mode here affects new checkout calculations only. Historical orders keep their stored tax snapshot. Do not enter a jurisdiction rate unless you intend to collect that rate.
      </p>
      <label className="block text-sm">
        Tax calculation mode
        <select className="mt-2 min-h-11 w-full min-w-0 rounded-xl border border-[#173f35]/15 px-3" defaultValue={mode} name="tax_mode">
          <option value="not_configured">Not Configured</option>
          <option value="no_tax">No Tax</option>
          <option value="manual_rate">Manual Rate</option>
        </select>
      </label>
      <label className="block text-sm">
        Tax name
        <input className="mt-2 min-h-11 w-full min-w-0 rounded-xl border border-[#173f35]/15 px-3" defaultValue={taxName || "Tax"} name="tax_name" />
      </label>
      <label className="block text-sm">
        Manual rate (%)
        <input className="mt-2 min-h-11 w-full min-w-0 rounded-xl border border-[#173f35]/15 px-3" defaultValue={taxRate != null ? String(taxRate) : ""} min="0" max="100" name="tax_rate_percent" step="0.0001" type="number" />
      </label>
      <p className="text-xs text-[#6b6b6b]">Manual Rate requires a number between 0 and 100. Leave this blank unless you select Manual Rate.</p>
      <label className="flex items-center gap-2 text-sm">
        <input defaultChecked={appliesToShipping} name="tax_applies_to_shipping" type="checkbox" />
        Apply tax to shipping / delivery
      </label>
      {state?.error ? <p className="text-sm text-red-800">{state.error}</p> : null}
      <button className="min-h-11 rounded-xl bg-[#173f35] px-4 py-2 text-sm text-white" type="submit">Save tax settings</button>
    </form>
  );
}
