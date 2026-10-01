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
    <form action={action} className="space-y-4 rounded-2xl bg-white p-5">
      <h2 className="font-semibold text-[#173f35]">Tax</h2>
      <p className="text-sm text-[#6b6b6b]">
        Square and PayPal charge the store-confirmed order total. They are not calculating sales tax for Ivoire Shop. Configure a store tax decision here. Historical orders keep the tax stored at checkout.
      </p>
      <p className="text-sm font-medium text-[#173f35]">Current: {taxModeLabel(mode)}</p>
      {mode === "not_configured" ? <p className="text-sm text-[#7c5d1a]">Tax configuration required</p> : null}
      <label className="block text-sm">
        Tax calculation mode
        <select className="mt-2 min-h-11 w-full rounded-xl border border-[#173f35]/15 px-3" defaultValue={mode} name="tax_mode">
          <option value="not_configured">Not configured (charge $0.00 tax until decided)</option>
          <option value="no_tax">No tax collected</option>
          <option value="manual_rate">Manual rate</option>
        </select>
      </label>
      <label className="block text-sm">
        Tax name
        <input className="mt-2 min-h-11 w-full rounded-xl border border-[#173f35]/15 px-3" defaultValue={taxName || "Tax"} name="tax_name" />
      </label>
      <label className="block text-sm">
        Manual rate (%)
        <input className="mt-2 min-h-11 w-full rounded-xl border border-[#173f35]/15 px-3" defaultValue={taxRate != null ? String(taxRate) : ""} min="0" max="100" name="tax_rate_percent" step="0.0001" type="number" />
      </label>
      <label className="flex items-center gap-2 text-sm">
        <input defaultChecked={appliesToShipping} name="tax_applies_to_shipping" type="checkbox" />
        Apply tax to shipping / delivery
      </label>
      {state?.error ? <p className="text-sm text-red-800">{state.error}</p> : null}
      <button className="min-h-11 rounded-xl bg-[#173f35] px-4 py-2 text-sm text-white" type="submit">Save tax settings</button>
    </form>
  );
}
