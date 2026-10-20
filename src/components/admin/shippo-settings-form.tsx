"use client";

import { useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { saveShippoSettings } from "@/src/lib/delivery/actions";

export function ShippoSettingsForm({
  settings,
  shippoConfigured,
  shippoTest,
}: {
  settings: Record<string, unknown> | null;
  shippoConfigured: boolean;
  shippoTest: boolean;
}) {
  const router = useRouter();
  const [state, action, pending] = useActionState(saveShippoSettings, null);
  useEffect(() => {
    if (!state?.saved) return;
    const timer = window.setTimeout(() => router.refresh(), 1800);
    return () => window.clearTimeout(timer);
  }, [state?.saved, router]);
  return (
    <form action={action} className="min-w-0 space-y-4 overflow-x-hidden rounded-2xl bg-white p-5">
      <h2 className="font-semibold text-[#173f35]">Shippo live rates</h2>
      <p className="text-sm text-[#6b6b6b]">
        {shippoConfigured
          ? shippoTest
            ? "A Shippo test token is configured on this environment. Rates shown at checkout are test rates, not production quotes."
            : "A Shippo token is configured. Live postage purchasing remains disabled until the founder turns it on."
          : "Shippo is not configured on this environment. Add a Shippo TEST token as SHIPPO_API_TOKEN on Vercel Production for Steel. Do not install a live token until production shipping is approved."}
      </p>
      <label className="flex items-center gap-2 text-sm">
        <input defaultChecked={Boolean(settings?.shippo_enabled)} name="shippo_enabled" type="checkbox" />
        Enable Shippo quotes when a carrier uses Live Carrier API
      </label>
      <label className="flex items-center gap-2 text-sm">
        <input defaultChecked={Boolean(settings?.shippo_allow_manual_fallback)} name="shippo_allow_manual_fallback" type="checkbox" />
        Allow labeled manual fallback when a live quote is unavailable (never silent)
      </label>
      <label className="flex items-center gap-2 text-sm">
        <input defaultChecked={Boolean(settings?.postage_purchases_enabled)} name="postage_purchases_enabled" type="checkbox" />
        Enable live postage purchases (keep off — production postage is blocked)
      </label>
      <label className="block text-sm">
        Shipping margin percent
        <input className="mt-2 min-h-11 w-full rounded-xl border border-[#173f35]/15 px-3" defaultValue={String(settings?.shippo_margin_percent ?? 0)} min="0" max="200" name="shippo_margin_percent" step="0.01" type="number" />
      </label>
      <label className="block text-sm">
        Allowed services (optional, comma-separated)
        <input className="mt-2 min-h-11 w-full rounded-xl border border-[#173f35]/15 px-3" defaultValue={String(settings?.shippo_allowed_services ?? "")} name="shippo_allowed_services" placeholder="Ground, Priority Mail" />
      </label>
      <label className="block text-sm">
        International country allowlist (ISO codes)
        <input className="mt-2 min-h-11 w-full rounded-xl border border-[#173f35]/15 px-3" defaultValue={String(settings?.shippo_international_countries ?? "")} name="shippo_international_countries" placeholder="CA, GB" />
      </label>
      <label className="block text-sm">
        Packing slip watermark text
        <input className="mt-2 min-h-11 w-full rounded-xl border border-[#173f35]/15 px-3" defaultValue={String(settings?.packing_slip_watermark_text ?? "IVOIRE SHOP")} name="packing_slip_watermark_text" />
      </label>
      <label className="block text-sm">
        Packing slip logo URL (Badger watermark)
        <input className="mt-2 min-h-11 w-full rounded-xl border border-[#173f35]/15 px-3" defaultValue={String(settings?.packing_slip_logo_url ?? "")} name="packing_slip_logo_url" placeholder="/brand/badger.svg" />
      </label>
      <p className="text-xs text-[#6b6b6b]">The watermark prints on Ivoire packing slips only. Carrier-required label fields from Shippo are not altered.</p>
      {state?.error ? <p className="text-sm text-red-800">{state.error}</p> : null}
      {state?.saved && !pending ? <p className="text-sm text-[#173f35]">Shippo settings saved.</p> : null}
      <button className="min-h-11 rounded-xl bg-[#173f35] px-4 py-2 text-sm text-white disabled:opacity-70" disabled={pending} type="submit">
        {pending ? "Saving…" : "Save Shippo settings"}
      </button>
    </form>
  );
}
