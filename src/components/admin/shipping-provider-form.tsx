"use client";

import { useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { saveShippingProviderSettings } from "@/src/lib/delivery/actions";

export function ShippingProviderForm({
  settings,
  easypostConfigured,
  easypostTest,
  easypostLive,
  easyshipConfigured,
  easyshipSandbox,
  easyshipProduction,
}: {
  settings: Record<string, unknown> | null;
  easypostConfigured: boolean;
  easypostTest: boolean;
  easypostLive: boolean;
  easyshipConfigured: boolean;
  easyshipSandbox: boolean;
  easyshipProduction: boolean;
}) {
  const router = useRouter();
  const [state, action, pending] = useActionState(saveShippingProviderSettings, null);
  useEffect(() => {
    if (!state?.saved) return;
    const timer = window.setTimeout(() => router.refresh(), 1800);
    return () => window.clearTimeout(timer);
  }, [state?.saved, router]);
  const selected = settings?.shipping_provider === "easypost"
    ? "easypost"
    : settings?.shipping_provider === "easyship"
      ? "easyship"
      : "shippo";
  return (
    <form action={action} className="min-w-0 space-y-4 overflow-x-hidden rounded-2xl bg-white p-5">
      <h2 className="font-semibold text-[#173f35]">Live rate provider</h2>
      <p className="text-sm text-[#6b6b6b]">
        Choose who supplies UPS and USPS checkout quotes. Shippo and EasyPost settings stay saved when Easyship is selected.
        Automatic postage purchases stay off.
      </p>
      <fieldset className="space-y-2">
        <legend className="text-sm font-medium text-[#173f35]">Provider</legend>
        <label className="flex items-center gap-2 text-sm">
          <input defaultChecked={selected === "shippo"} name="shipping_provider" type="radio" value="shippo" />
          Shippo (existing integration)
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input defaultChecked={selected === "easypost"} name="shipping_provider" type="radio" value="easypost" />
          EasyPost Free Access (Wallet UPS/USPS)
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input defaultChecked={selected === "easyship"} name="shipping_provider" type="radio" value="easyship" />
          Easyship (UPS/USPS rates)
        </label>
      </fieldset>
      <p className="text-sm text-[#6b6b6b]">
        {easypostConfigured
          ? easypostTest
            ? "An EasyPost TEST key is configured. Sandbox rates can be labeled TEST at checkout when EasyPost quotes are enabled."
            : easypostLive
              ? "An EasyPost production key is configured. Customer-facing live rates stay off until you enable them after a verified production quote."
              : "An EasyPost key is present but the format is unrecognized."
          : "EasyPost is not configured. Add EASYPOST_API_KEY (TEST key first) to Vercel Production as a Secret."}
      </p>
      <p className="text-sm text-[#6b6b6b]">
        {easyshipConfigured
          ? easyshipSandbox
            ? "An Easyship sandbox key prefix is configured. Sandbox rates never appear as customer checkout prices. A courier service list is not confirmed rate availability."
            : easyshipProduction
              ? "An Easyship production key prefix is configured. Customer-facing live rates stay off until you enable them after a verified production quote. Rate scope and UPS/USPS availability stay unverified until a quote is requested."
              : "An Easyship key is present but the format is unrecognized. Expected a sand_ sandbox key or a prod_ production key."
          : "Easyship is not configured. Add EASYSHIP_API_KEY to Vercel Production as a Secret."}
      </p>
      <label className="flex items-center gap-2 text-sm">
        <input defaultChecked={Boolean(settings?.easypost_enabled)} name="easypost_enabled" type="checkbox" />
        Enable EasyPost quotes when EasyPost is the selected provider
      </label>
      <label className="flex items-center gap-2 text-sm">
        <input defaultChecked={Boolean(settings?.easypost_customer_rates_enabled)} name="easypost_customer_rates_enabled" type="checkbox" />
        Allow customer-facing EasyPost production rates (keep off until a production quote is verified)
      </label>
      <label className="flex items-center gap-2 text-sm">
        <input defaultChecked={Boolean(settings?.easyship_enabled)} name="easyship_enabled" type="checkbox" />
        Enable Easyship quotes when Easyship is the selected provider
      </label>
      <label className="flex items-center gap-2 text-sm">
        <input defaultChecked={Boolean(settings?.easyship_customer_rates_enabled)} name="easyship_customer_rates_enabled" type="checkbox" />
        Allow customer-facing Easyship production rates (keep off until a production quote is verified)
      </label>
      {state?.error ? <p className="text-sm text-red-800">{state.error}</p> : null}
      {state?.saved && !pending ? <p className="text-sm text-[#173f35]">Shipping provider saved.</p> : null}
      <button className="min-h-11 rounded-xl bg-[#173f35] px-4 py-2 text-sm text-white disabled:opacity-70" disabled={pending} type="submit">
        {pending ? "Saving…" : "Save provider"}
      </button>
    </form>
  );
}
