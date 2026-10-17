"use client";

import { useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { saveIvoireShippingSettings } from "@/src/lib/delivery/actions";
import { ivoireShippingConfigFromRow } from "@/src/lib/shipping/estimate";
import { AdminSaveButton } from "@/src/components/admin/admin-save-button";

export function IvoireShippingForm({ settings }: { settings: Record<string, unknown> | null }) {
  const router = useRouter();
  const [state, action, pending] = useActionState(saveIvoireShippingSettings, null);
  const config = ivoireShippingConfigFromRow(settings);
  const domestic = config.zones.find((zone) => zone.match === "domestic") ?? config.zones[0];
  const international = config.zones.find((zone) => zone.match === "international") ?? config.zones[1];
  useEffect(() => {
    if (!state?.saved) return;
    const timer = window.setTimeout(() => router.refresh(), 1800);
    return () => window.clearTimeout(timer);
  }, [state?.saved, router]);
  return (
    <form action={action} className="min-w-0 space-y-4 overflow-x-hidden rounded-2xl bg-white p-5">
      <h2 className="font-semibold text-[#173f35]">Ivoire AI Shipping</h2>
      <p className="text-sm text-[#6b6b6b]">
        Store-calculated shipping from package weight, size, origin, destination, and your zone rates. This is not a live UPS or USPS quote. Estimates recalculate when the cart, address, or these rules change, and again when the order is submitted. No AI model is called during checkout.
      </p>
      <label className="flex items-center gap-2 text-sm">
        <input defaultChecked={config.enabled} name="ivoire_shipping_enabled" type="checkbox" />
        Offer Ivoire Shop shipping at checkout
      </label>
      <div className="grid gap-3 sm:grid-cols-3">
        <label className="text-sm">Markup %<input className="mt-2 min-h-11 w-full rounded-xl border border-[#173f35]/15 px-3" defaultValue={config.markup_percent} name="ivoire_shipping_markup_percent" step="0.01" type="number" /></label>
        <label className="text-sm">Fallback amount<input className="mt-2 min-h-11 w-full rounded-xl border border-[#173f35]/15 px-3" defaultValue={config.fallback_amount ?? ""} name="ivoire_shipping_fallback_amount" step="0.01" type="number" /></label>
        <label className="text-sm">Max weight (lb)<input className="mt-2 min-h-11 w-full rounded-xl border border-[#173f35]/15 px-3" defaultValue={config.max_weight_lb ?? ""} name="ivoire_shipping_max_weight_lb" step="0.01" type="number" /></label>
      </div>
      <fieldset className="grid gap-3 rounded-xl border border-[#173f35]/10 p-4 sm:grid-cols-2">
        <legend className="px-1 text-sm font-semibold">Domestic US</legend>
        <label className="flex items-center gap-2 text-sm sm:col-span-2"><input defaultChecked={domestic?.is_active !== false} name="zone_domestic_enabled" type="checkbox" /> Enable</label>
        <label className="text-sm">Base<input className="mt-2 min-h-11 w-full rounded-xl border border-[#173f35]/15 px-3" defaultValue={domestic?.base_rate} name="zone_domestic_base" step="0.01" type="number" /></label>
        <label className="text-sm">Per lb<input className="mt-2 min-h-11 w-full rounded-xl border border-[#173f35]/15 px-3" defaultValue={domestic?.per_lb} name="zone_domestic_per_lb" step="0.01" type="number" /></label>
        <label className="text-sm">Surcharge<input className="mt-2 min-h-11 w-full rounded-xl border border-[#173f35]/15 px-3" defaultValue={domestic?.surcharge} name="zone_domestic_surcharge" step="0.01" type="number" /></label>
        <label className="text-sm">Max lb<input className="mt-2 min-h-11 w-full rounded-xl border border-[#173f35]/15 px-3" defaultValue={domestic?.max_weight_lb ?? ""} name="zone_domestic_max" step="0.01" type="number" /></label>
      </fieldset>
      <fieldset className="grid gap-3 rounded-xl border border-[#173f35]/10 p-4 sm:grid-cols-2">
        <legend className="px-1 text-sm font-semibold">International</legend>
        <label className="flex items-center gap-2 text-sm sm:col-span-2"><input defaultChecked={international?.is_active !== false} name="zone_international_enabled" type="checkbox" /> Enable</label>
        <label className="text-sm">Base<input className="mt-2 min-h-11 w-full rounded-xl border border-[#173f35]/15 px-3" defaultValue={international?.base_rate} name="zone_international_base" step="0.01" type="number" /></label>
        <label className="text-sm">Per lb<input className="mt-2 min-h-11 w-full rounded-xl border border-[#173f35]/15 px-3" defaultValue={international?.per_lb} name="zone_international_per_lb" step="0.01" type="number" /></label>
        <label className="text-sm">Surcharge<input className="mt-2 min-h-11 w-full rounded-xl border border-[#173f35]/15 px-3" defaultValue={international?.surcharge} name="zone_international_surcharge" step="0.01" type="number" /></label>
        <label className="text-sm">Max lb<input className="mt-2 min-h-11 w-full rounded-xl border border-[#173f35]/15 px-3" defaultValue={international?.max_weight_lb ?? ""} name="zone_international_max" step="0.01" type="number" /></label>
      </fieldset>
      {state?.error ? <p className="text-sm text-red-800">{state.error}</p> : null}
      {state?.saved && !pending ? <p className="text-sm text-[#173f35]">Settings saved.</p> : null}
      <AdminSaveButton failed={Boolean(state?.error) && !pending} idleLabel="Save Ivoire shipping" pending={pending} saved={Boolean(state?.saved) && !pending} />
    </form>
  );
}
