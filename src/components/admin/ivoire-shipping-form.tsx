"use client";

import { useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { previewIvoireShipping, saveIvoireShippingSettings } from "@/src/lib/delivery/actions";
import { ivoireShippingConfigFromRow, ivoireShippingConfigIssues } from "@/src/lib/shipping/estimate";
import { AdminSaveButton } from "@/src/components/admin/admin-save-button";

export function IvoireShippingForm({
  originComplete,
  settings,
}: {
  settings: Record<string, unknown> | null;
  originComplete: boolean;
}) {
  const router = useRouter();
  const [state, action, pending] = useActionState(saveIvoireShippingSettings, null);
  const [preview, previewAction, previewPending] = useActionState(previewIvoireShipping, null);
  const config = ivoireShippingConfigFromRow(settings);
  const issues = ivoireShippingConfigIssues(config, originComplete);
  const domestic = config.zones.find((zone) => zone.match === "domestic") ?? config.zones[0];
  const international = config.zones.find((zone) => zone.match === "international") ?? config.zones[1];
  useEffect(() => {
    if (!state?.saved) return;
    const timer = window.setTimeout(() => router.refresh(), 1800);
    return () => window.clearTimeout(timer);
  }, [state?.saved, router]);
  return (
    <div className="space-y-4">
      <form action={action} className="min-w-0 space-y-4 overflow-x-hidden rounded-2xl bg-white p-5">
        <h2 className="font-semibold text-[#173f35]">Ivoire Shop Shipping</h2>
        <p className="text-sm text-[#6b6b6b]">
          Rules-based store shipping from package weight, size, origin, destination ZIP, and your zone rates. This is not a live UPS or USPS quote, and checkout does not call an AI model. Optional model-assisted packing advice can be considered later, off the payment path.
        </p>
        {issues.length ? (
          <ul className="list-disc space-y-1 rounded-xl border border-[#b8964c]/40 bg-[#fbf6ea] px-5 py-3 text-sm text-[#7c5d1a]">
            {issues.map((issue) => <li key={issue}>{issue}</li>)}
          </ul>
        ) : null}
        <label className="flex items-center gap-2 text-sm">
          <input defaultChecked={config.enabled} name="ivoire_shipping_enabled" type="checkbox" />
          Offer Ivoire Shop shipping at checkout
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input defaultChecked={config.require_us_zip} name="ivoire_require_us_zip" type="checkbox" />
          Require a valid U.S. ZIP for domestic Ivoire shipping
        </label>
        <div className="grid gap-3 sm:grid-cols-3">
          <label className="text-sm">Markup %<input className="mt-2 min-h-11 w-full rounded-xl border border-[#173f35]/15 px-3" defaultValue={config.markup_percent} name="ivoire_shipping_markup_percent" step="0.01" type="number" /></label>
          <label className="text-sm">Handling fee<input className="mt-2 min-h-11 w-full rounded-xl border border-[#173f35]/15 px-3" defaultValue={config.handling_fee || ""} name="ivoire_shipping_handling_fee" step="0.01" type="number" /></label>
          <label className="text-sm">Fallback amount<input className="mt-2 min-h-11 w-full rounded-xl border border-[#173f35]/15 px-3" defaultValue={config.fallback_amount ?? ""} name="ivoire_shipping_fallback_amount" step="0.01" type="number" /></label>
          <label className="text-sm">Min charge<input className="mt-2 min-h-11 w-full rounded-xl border border-[#173f35]/15 px-3" defaultValue={config.min_charge ?? ""} name="ivoire_shipping_min_charge" step="0.01" type="number" /></label>
          <label className="text-sm">Max charge<input className="mt-2 min-h-11 w-full rounded-xl border border-[#173f35]/15 px-3" defaultValue={config.max_charge ?? ""} name="ivoire_shipping_max_charge" step="0.01" type="number" /></label>
          <label className="text-sm">Max weight (lb)<input className="mt-2 min-h-11 w-full rounded-xl border border-[#173f35]/15 px-3" defaultValue={config.max_weight_lb ?? ""} name="ivoire_shipping_max_weight_lb" step="0.01" type="number" /></label>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="text-sm">If weight/size is missing
            <select className="mt-2 min-h-11 w-full rounded-xl border border-[#173f35]/15 px-3" defaultValue={config.missing_info_policy} name="ivoire_missing_info_policy">
              <option value="fallback">Use fallback charge</option>
              <option value="block">Do not quote Ivoire shipping</option>
            </select>
          </label>
          <label className="text-sm">If U.S. ZIP is invalid
            <select className="mt-2 min-h-11 w-full rounded-xl border border-[#173f35]/15 px-3" defaultValue={config.invalid_zip_policy} name="ivoire_invalid_zip_policy">
              <option value="block">Do not quote Ivoire shipping</option>
              <option value="fallback">Use fallback charge</option>
            </select>
          </label>
        </div>
        <fieldset className="grid gap-3 rounded-xl border border-[#173f35]/10 p-4 sm:grid-cols-4">
          <legend className="px-1 text-sm font-semibold">Package defaults</legend>
          <label className="text-sm">Weight lb<input className="mt-2 min-h-11 w-full rounded-xl border border-[#173f35]/15 px-3" defaultValue={config.package_defaults.weight_lb ?? ""} name="default_weight_lb" step="0.01" type="number" /></label>
          <label className="text-sm">Length in<input className="mt-2 min-h-11 w-full rounded-xl border border-[#173f35]/15 px-3" defaultValue={config.package_defaults.length_in ?? ""} name="default_length_in" step="0.01" type="number" /></label>
          <label className="text-sm">Width in<input className="mt-2 min-h-11 w-full rounded-xl border border-[#173f35]/15 px-3" defaultValue={config.package_defaults.width_in ?? ""} name="default_width_in" step="0.01" type="number" /></label>
          <label className="text-sm">Height in<input className="mt-2 min-h-11 w-full rounded-xl border border-[#173f35]/15 px-3" defaultValue={config.package_defaults.height_in ?? ""} name="default_height_in" step="0.01" type="number" /></label>
        </fieldset>
        <fieldset className="grid gap-3 rounded-xl border border-[#173f35]/10 p-4 sm:grid-cols-2">
          <legend className="px-1 text-sm font-semibold">Domestic US</legend>
          <label className="flex items-center gap-2 text-sm sm:col-span-2"><input defaultChecked={domestic?.is_active !== false} name="zone_domestic_enabled" type="checkbox" /> Enable</label>
          <label className="text-sm">Base<input className="mt-2 min-h-11 w-full rounded-xl border border-[#173f35]/15 px-3" defaultValue={domestic?.base_rate} name="zone_domestic_base" step="0.01" type="number" /></label>
          <label className="text-sm">Per lb<input className="mt-2 min-h-11 w-full rounded-xl border border-[#173f35]/15 px-3" defaultValue={domestic?.per_lb} name="zone_domestic_per_lb" step="0.01" type="number" /></label>
          <label className="text-sm">Surcharge<input className="mt-2 min-h-11 w-full rounded-xl border border-[#173f35]/15 px-3" defaultValue={domestic?.surcharge} name="zone_domestic_surcharge" step="0.01" type="number" /></label>
          <label className="text-sm">Max lb<input className="mt-2 min-h-11 w-full rounded-xl border border-[#173f35]/15 px-3" defaultValue={domestic?.max_weight_lb ?? ""} name="zone_domestic_max" step="0.01" type="number" /></label>
          <label className="text-sm sm:col-span-2">ZIP prefixes (optional, comma-separated)<input className="mt-2 min-h-11 w-full rounded-xl border border-[#173f35]/15 px-3" defaultValue={domestic?.zip_prefixes.join(", ")} name="zone_domestic_zips" placeholder="Leave blank for all U.S. ZIPs" /></label>
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
        {state?.saved && !pending ? <p className="text-sm text-[#173f35]">Settings saved. Checkout will use these rules after refresh.</p> : null}
        <AdminSaveButton failed={Boolean(state?.error) && !pending} idleLabel="Save Ivoire shipping" pending={pending} saved={Boolean(state?.saved) && !pending} />
      </form>
      <form action={previewAction} className="min-w-0 space-y-4 overflow-x-hidden rounded-2xl bg-white p-5">
        <h3 className="font-semibold text-[#173f35]">Preview estimate</h3>
        <p className="text-sm text-[#6b6b6b]">Uses the last saved rules. Does not place an order or call a carrier.</p>
        <div className="grid gap-3 sm:grid-cols-4">
          <label className="text-sm">Country<input className="mt-2 min-h-11 w-full rounded-xl border border-[#173f35]/15 px-3" defaultValue="US" name="preview_country" /></label>
          <label className="text-sm">ZIP<input className="mt-2 min-h-11 w-full rounded-xl border border-[#173f35]/15 px-3" defaultValue="30093" name="preview_zip" /></label>
          <label className="text-sm">Weight lb<input className="mt-2 min-h-11 w-full rounded-xl border border-[#173f35]/15 px-3" defaultValue="4" name="preview_weight" step="0.01" type="number" /></label>
          <label className="text-sm">Qty<input className="mt-2 min-h-11 w-full rounded-xl border border-[#173f35]/15 px-3" defaultValue="1" name="preview_qty" min="1" type="number" /></label>
        </div>
        <button className="min-h-11 rounded-xl border border-[#173f35]/20 px-4 py-2 text-sm font-medium text-[#173f35]" disabled={previewPending} type="submit">
          {previewPending ? "Calculating…" : "Preview shipping"}
        </button>
        {preview?.error ? <p className="text-sm text-red-800">{preview.error}</p> : null}
        {preview && !preview.error ? (
          <dl className="space-y-2 rounded-xl border border-[#173f35]/10 bg-[#f7f4ee] p-4 text-sm text-[#173f35]">
            <div className="flex justify-between gap-4"><dt>Charge</dt><dd className="font-semibold">{preview.blocked ? "Not quoted" : `$${(preview.amount ?? 0).toFixed(2)}`}</dd></div>
            <div className="flex justify-between gap-4"><dt>Zone</dt><dd>{preview.zoneName || "—"}</dd></div>
            <div className="flex justify-between gap-4"><dt>Billable lb</dt><dd>{preview.weight ?? "—"}</dd></div>
            <div className="flex justify-between gap-4"><dt>Fallback used</dt><dd>{preview.usedFallback ? "Yes" : "No"}</dd></div>
            <div className="flex justify-between gap-4"><dt>Package defaults used</dt><dd>{preview.usedDefaults ? "Yes" : "No"}</dd></div>
            <div><dt className="text-[#6b6b6b]">Details</dt><dd className="mt-1">{preview.explanation}</dd></div>
          </dl>
        ) : null}
      </form>
    </div>
  );
}
