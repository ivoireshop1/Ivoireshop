"use client";

import { useActionState } from "react";
import { saveStoreOrigin } from "@/src/lib/delivery/actions";

export function DeliveryOriginForm({
  origin,
  radius,
  pickupEnabled,
  storeDeliveryEnabled,
  doordashEnabled,
  upsEnabled,
  uspsEnabled,
}: {
  origin: {
    name: string;
    phone: string;
    address_line_1: string;
    address_line_2: string;
    city: string;
    state: string;
    postal_code: string;
    country: string;
  };
  radius: number | string | null | undefined;
  pickupEnabled: boolean;
  storeDeliveryEnabled: boolean;
  doordashEnabled: boolean;
  upsEnabled: boolean;
  uspsEnabled: boolean;
}) {
  const [state, action] = useActionState(saveStoreOrigin, null);
  return (
    <form action={action} className="space-y-4 rounded-2xl bg-white p-5">
      <h2 className="font-semibold text-[#173f35]">Store origin</h2>
      <p className="text-sm text-[#6b6b6b]">Used as the ship-from / pickup address for quotes. Do not store API secrets here.</p>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="text-sm">Business/store name<input className="mt-2 min-h-11 w-full rounded-xl border border-[#173f35]/15 px-3" defaultValue={origin.name} name="origin_name" required /></label>
        <label className="text-sm">Contact phone<input className="mt-2 min-h-11 w-full rounded-xl border border-[#173f35]/15 px-3" defaultValue={origin.phone} name="origin_phone" /></label>
        <label className="sm:col-span-2 text-sm">Address line 1<input className="mt-2 min-h-11 w-full rounded-xl border border-[#173f35]/15 px-3" defaultValue={origin.address_line_1} name="origin_address_line_1" required /></label>
        <label className="sm:col-span-2 text-sm">Address line 2<input className="mt-2 min-h-11 w-full rounded-xl border border-[#173f35]/15 px-3" defaultValue={origin.address_line_2} name="origin_address_line_2" /></label>
        <label className="text-sm">City<input className="mt-2 min-h-11 w-full rounded-xl border border-[#173f35]/15 px-3" defaultValue={origin.city} name="origin_city" required /></label>
        <label className="text-sm">State<input className="mt-2 min-h-11 w-full rounded-xl border border-[#173f35]/15 px-3" defaultValue={origin.state} name="origin_state" /></label>
        <label className="text-sm">ZIP / postal code<input className="mt-2 min-h-11 w-full rounded-xl border border-[#173f35]/15 px-3" defaultValue={origin.postal_code} name="origin_postal_code" required /></label>
        <label className="text-sm">Country<input className="mt-2 min-h-11 w-full rounded-xl border border-[#173f35]/15 px-3" defaultValue={origin.country || "US"} name="origin_country" required /></label>
        <label className="text-sm">Ivoire Shop local radius (miles)<input className="mt-2 min-h-11 w-full rounded-xl border border-[#173f35]/15 px-3" defaultValue={radius ?? ""} name="doordash_max_radius_miles" type="number" min="0" step="0.1" /></label>
      </div>
      <p className="text-xs text-[#6b6b6b]">Radius is an Ivoire Shop business rule. DoorDash quote/serviceability remains authoritative when connected.</p>
      <div className="grid gap-2 text-sm">
        <label className="flex items-center gap-2"><input defaultChecked={pickupEnabled} name="pickup_enabled" type="checkbox" /> Pickup</label>
        <label className="flex items-center gap-2"><input defaultChecked={storeDeliveryEnabled} name="store_delivery_enabled" type="checkbox" /> Store-arranged delivery</label>
        <label className="flex items-center gap-2"><input defaultChecked={doordashEnabled} name="doordash_enabled" type="checkbox" /> DoorDash local delivery</label>
        <label className="flex items-center gap-2"><input defaultChecked={upsEnabled} name="ups_enabled" type="checkbox" /> UPS</label>
        <label className="flex items-center gap-2"><input defaultChecked={uspsEnabled} name="usps_enabled" type="checkbox" /> USPS</label>
      </div>
      {state?.error ? <p className="text-sm text-red-800">{state.error}</p> : null}
      <button className="min-h-11 rounded-xl bg-[#173f35] px-4 py-2 text-sm text-white" type="submit">Save origin and switches</button>
    </form>
  );
}
