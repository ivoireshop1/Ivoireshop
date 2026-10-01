"use client";

import { useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { saveManualShipping } from "@/src/lib/delivery/actions";
import { parseRateMode, rateModeLabel } from "@/src/lib/delivery/manual";

function CarrierFields({
  carrier,
  settings,
}: {
  carrier: "ups" | "usps";
  settings: Record<string, unknown> | null;
}) {
  const prefix = carrier;
  const mode = parseRateMode(settings?.[`${prefix}_rate_mode`]);
  return (
    <fieldset className="min-w-0 space-y-3 rounded-xl border border-[#173f35]/10 p-4">
      <legend className="font-semibold text-[#173f35]">{carrier.toUpperCase()} — Manual Shipping</legend>
      <p className="text-xs text-[#6b6b6b]">Customers see {carrier.toUpperCase()} Shipping. This is an Ivoire Shop shipping charge, not a live carrier quote.</p>
      <label className="flex items-center gap-2 text-sm"><input defaultChecked={Boolean(settings?.[`${prefix}_enabled`])} name={`${prefix}_enabled`} type="checkbox" /> Enabled</label>
      <label className="flex items-center gap-2 text-sm"><input defaultChecked={settings?.[`${prefix}_show_at_checkout`] !== false} name={`${prefix}_show_at_checkout`} type="checkbox" /> Show at Checkout</label>
      <label className="flex items-center gap-2 text-sm"><input defaultChecked={Boolean(settings?.[`${prefix}_domestic_enabled`])} name={`${prefix}_domestic_enabled`} type="checkbox" /> Domestic</label>
      <label className="flex items-center gap-2 text-sm"><input defaultChecked={Boolean(settings?.[`${prefix}_international_enabled`])} name={`${prefix}_international_enabled`} type="checkbox" /> International</label>
      <p className="text-xs text-[#6b6b6b]">International only offers this manual option when the destination is eligible. It is not worldwide shipping.</p>
      <label className="block text-sm">
        Rate Mode
        <select className="mt-2 min-h-11 w-full min-w-0 rounded-xl border border-[#173f35]/15 px-3" defaultValue={mode} name={`${prefix}_rate_mode`}>
          <option value="store_rate">{rateModeLabel("store_rate")}</option>
          <option value="manual_quote">{rateModeLabel("manual_quote")}</option>
          <option value="live_api">{rateModeLabel("live_api")} (not connected)</option>
        </select>
      </label>
      <p className="text-xs text-[#6b6b6b]">Live Carrier API stays unavailable until credentials and verification exist.</p>
      <label className="block text-sm">Domestic Charge (USD)<input className="mt-2 min-h-11 w-full min-w-0 rounded-xl border border-[#173f35]/15 px-3" defaultValue={settings?.[`${prefix}_domestic_charge`] != null ? String(settings[`${prefix}_domestic_charge`]) : ""} min="0" name={`${prefix}_domestic_charge`} step="0.01" type="number" /></label>
      <label className="block text-sm">International Charge (USD)<input className="mt-2 min-h-11 w-full min-w-0 rounded-xl border border-[#173f35]/15 px-3" defaultValue={settings?.[`${prefix}_international_charge`] != null ? String(settings[`${prefix}_international_charge`]) : ""} min="0" name={`${prefix}_international_charge`} step="0.01" type="number" /></label>
      <label className="block text-sm">Handling fee (optional)<input className="mt-2 min-h-11 w-full min-w-0 rounded-xl border border-[#173f35]/15 px-3" defaultValue={settings?.[`${prefix}_handling_fee`] != null ? String(settings[`${prefix}_handling_fee`]) : ""} min="0" name={`${prefix}_handling_fee`} step="0.01" type="number" /></label>
      <label className="block text-sm">Free-shipping threshold (optional)<input className="mt-2 min-h-11 w-full min-w-0 rounded-xl border border-[#173f35]/15 px-3" defaultValue={settings?.[`${prefix}_free_shipping_threshold`] != null ? String(settings[`${prefix}_free_shipping_threshold`]) : ""} min="0" name={`${prefix}_free_shipping_threshold`} step="0.01" type="number" /></label>
    </fieldset>
  );
}

export function ManualShippingForm({
  settings,
}: {
  settings: Record<string, unknown> | null;
}) {
  const router = useRouter();
  const [state, action, pending] = useActionState(saveManualShipping, null);
  useEffect(() => {
    if (!state?.saved) return;
    const timer = window.setTimeout(() => router.refresh(), 1800);
    return () => window.clearTimeout(timer);
  }, [state?.saved, router]);
  const failed = Boolean(state?.error) && !pending;
  const saved = Boolean(state?.saved) && !pending && !state?.error;
  return (
    <form action={action} className="min-w-0 space-y-4 overflow-x-hidden rounded-2xl bg-white p-5">
      <h2 className="font-semibold text-[#173f35]">Shipping Rate Manager</h2>
      <p className="text-sm text-[#6b6b6b]">
        Set Ivoire Shop shipping charges. Historical orders keep the amount the customer paid. Actual postage is recorded on the order later and never changes that charge.
      </p>
      <div className="grid gap-6 lg:grid-cols-2">
        <CarrierFields carrier="ups" settings={settings} />
        <CarrierFields carrier="usps" settings={settings} />
      </div>
      {state?.error ? <p className="text-sm text-red-800">{state.error}</p> : null}
      {saved ? <p className="text-sm text-[#173f35]">Shipping settings saved.</p> : null}
      <button
        className="min-h-11 min-w-[11rem] rounded-xl bg-[#173f35] px-4 py-2 text-sm text-white disabled:opacity-70"
        disabled={pending}
        type="submit"
      >
        {pending ? "Saving…" : failed ? "Couldn’t save" : saved ? "Saved ✓" : "Save shipping rates"}
      </button>
    </form>
  );
}
