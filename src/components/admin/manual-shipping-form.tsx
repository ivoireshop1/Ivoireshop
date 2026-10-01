"use client";

import { useActionState } from "react";
import { saveManualShipping } from "@/src/lib/delivery/actions";

export function ManualShippingForm({
  settings,
}: {
  settings: Record<string, unknown> | null;
}) {
  const [state, action] = useActionState(saveManualShipping, null);
  return (
    <form action={action} className="space-y-4 rounded-2xl bg-white p-5">
      <h2 className="font-semibold text-[#173f35]">Manual carrier charges</h2>
      <p className="text-sm text-[#6b6b6b]">
        These are Ivoire Shop shipping charges, not live UPS or USPS rate quotes. Historical orders keep the amount charged at checkout.
      </p>
      <div className="grid gap-6 lg:grid-cols-2">
        <fieldset className="space-y-3 rounded-xl border border-[#173f35]/10 p-4">
          <legend className="font-semibold text-[#173f35]">UPS — Manual Shipping</legend>
          <label className="flex items-center gap-2 text-sm"><input defaultChecked={Boolean(settings?.ups_enabled)} name="ups_enabled" type="checkbox" /> Enable UPS at checkout</label>
          <label className="flex items-center gap-2 text-sm"><input defaultChecked={Boolean(settings?.ups_domestic_enabled)} name="ups_domestic_enabled" type="checkbox" /> Domestic</label>
          <label className="text-sm">Domestic charge (USD)<input className="mt-2 min-h-11 w-full rounded-xl border border-[#173f35]/15 px-3" defaultValue={settings?.ups_domestic_charge != null ? String(settings.ups_domestic_charge) : ""} min="0" name="ups_domestic_charge" step="0.01" type="number" /></label>
          <label className="flex items-center gap-2 text-sm"><input defaultChecked={Boolean(settings?.ups_international_enabled)} name="ups_international_enabled" type="checkbox" /> International</label>
          <label className="text-sm">International charge (USD)<input className="mt-2 min-h-11 w-full rounded-xl border border-[#173f35]/15 px-3" defaultValue={settings?.ups_international_charge != null ? String(settings.ups_international_charge) : ""} min="0" name="ups_international_charge" step="0.01" type="number" /></label>
        </fieldset>
        <fieldset className="space-y-3 rounded-xl border border-[#173f35]/10 p-4">
          <legend className="font-semibold text-[#173f35]">USPS — Manual Shipping</legend>
          <label className="flex items-center gap-2 text-sm"><input defaultChecked={Boolean(settings?.usps_enabled)} name="usps_enabled" type="checkbox" /> Enable USPS at checkout</label>
          <label className="flex items-center gap-2 text-sm"><input defaultChecked={Boolean(settings?.usps_domestic_enabled)} name="usps_domestic_enabled" type="checkbox" /> Domestic</label>
          <label className="text-sm">Domestic charge (USD)<input className="mt-2 min-h-11 w-full rounded-xl border border-[#173f35]/15 px-3" defaultValue={settings?.usps_domestic_charge != null ? String(settings.usps_domestic_charge) : ""} min="0" name="usps_domestic_charge" step="0.01" type="number" /></label>
          <label className="flex items-center gap-2 text-sm"><input defaultChecked={Boolean(settings?.usps_international_enabled)} name="usps_international_enabled" type="checkbox" /> International</label>
          <label className="text-sm">International charge (USD)<input className="mt-2 min-h-11 w-full rounded-xl border border-[#173f35]/15 px-3" defaultValue={settings?.usps_international_charge != null ? String(settings.usps_international_charge) : ""} min="0" name="usps_international_charge" step="0.01" type="number" /></label>
        </fieldset>
      </div>
      {state?.error ? <p className="text-sm text-red-800">{state.error}</p> : null}
      <button className="min-h-11 rounded-xl bg-[#173f35] px-4 py-2 text-sm text-white" type="submit">Save shipping charges</button>
    </form>
  );
}
