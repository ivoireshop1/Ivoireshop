"use client";

import { useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { saveTaxSettings } from "@/src/lib/delivery/actions";
import { AdminSaveButton } from "@/src/components/admin/admin-save-button";

export function TaxSettingsForm({
  tax1Enabled,
  tax1Name,
  tax1Rate,
  tax1Shipping,
  tax2Enabled,
  tax2Name,
  tax2Rate,
  tax2Shipping,
}: {
  tax1Enabled?: boolean;
  tax1Name?: string | null;
  tax1Rate?: number | string | null;
  tax1Shipping?: boolean;
  tax2Enabled?: boolean;
  tax2Name?: string | null;
  tax2Rate?: number | string | null;
  tax2Shipping?: boolean;
  taxMode?: string | null;
  taxRate?: number | string | null;
  appliesToShipping?: boolean;
  taxName?: string | null;
}) {
  const router = useRouter();
  const [state, action, pending] = useActionState(saveTaxSettings, null);
  useEffect(() => {
    if (!state?.saved) return;
    const timer = window.setTimeout(() => router.refresh(), 1800);
    return () => window.clearTimeout(timer);
  }, [state?.saved, router]);
  return (
    <form action={action} className="min-w-0 space-y-4 overflow-x-hidden rounded-2xl bg-white p-5">
      <h2 className="font-semibold text-[#173f35]">Taxes</h2>
      <p className="text-sm text-[#6b6b6b]">
        Client-managed store tax rules. Tax 1 and Tax 2 are independent — enable neither, either, or both. New checkouts use these rates; historical orders keep their stored snapshot. The store owner is responsible for choosing rates that match their tax obligations. This software does not determine legal tax rates, grocery exemptions, or destination-based jurisdiction rules.
      </p>
      <p className="text-sm text-[#6b6b6b]">
        Per-product tax classes and automatic location-based tax lookup are not available in this release. Use Tax 1 / Tax 2 for the rates the business has decided to collect.
      </p>
      <TaxRuleFields appliesToShipping={Boolean(tax1Shipping)} enabled={Boolean(tax1Enabled)} name={tax1Name || "Tax 1"} prefix="tax_1" rate={tax1Rate} title="Tax 1" />
      <TaxRuleFields appliesToShipping={Boolean(tax2Shipping)} enabled={Boolean(tax2Enabled)} name={tax2Name || "Tax 2"} prefix="tax_2" rate={tax2Rate} title="Tax 2" />
      {state?.error ? <p className="text-sm text-red-800">{state.error}</p> : null}
      {state?.saved && !pending ? <p className="text-sm text-[#173f35]">Settings saved.</p> : null}
      <AdminSaveButton failed={Boolean(state?.error) && !pending} idleLabel="Save tax settings" pending={pending} saved={Boolean(state?.saved) && !pending} />
    </form>
  );
}

function TaxRuleFields({
  title,
  prefix,
  enabled,
  name,
  rate,
  appliesToShipping,
}: {
  title: string;
  prefix: string;
  enabled: boolean;
  name: string;
  rate: number | string | null | undefined;
  appliesToShipping: boolean;
}) {
  return (
    <fieldset className="space-y-3 rounded-xl border border-[#173f35]/10 p-4">
      <legend className="px-1 text-sm font-semibold text-[#173f35]">{title}</legend>
      <label className="flex items-center gap-2 text-sm">
        <input defaultChecked={enabled} name={`${prefix}_enabled`} type="checkbox" />
        Enable {title}
      </label>
      <label className="block text-sm">
        Name
        <input className="mt-2 min-h-11 w-full min-w-0 rounded-xl border border-[#173f35]/15 px-3" defaultValue={name} name={`${prefix}_name`} />
      </label>
      <label className="block text-sm">
        Rate (%)
        <input className="mt-2 min-h-11 w-full min-w-0 rounded-xl border border-[#173f35]/15 px-3" defaultValue={rate != null ? String(rate) : ""} max="100" min="0" name={`${prefix}_rate_percent`} step="0.0001" type="number" />
      </label>
      <label className="flex items-center gap-2 text-sm">
        <input defaultChecked={appliesToShipping} name={`${prefix}_applies_to_shipping`} type="checkbox" />
        Apply to shipping / delivery
      </label>
    </fieldset>
  );
}
