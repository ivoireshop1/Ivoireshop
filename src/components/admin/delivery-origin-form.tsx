"use client";

import { useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { saveStoreOrigin } from "@/src/lib/delivery/actions";
import { AdminSaveButton } from "@/src/components/admin/admin-save-button";

export function DeliveryOriginForm({
  origin,
  radius,
  localCharge,
  pickupEnabled,
  pickupShowAtCheckout,
  storeDeliveryEnabled,
  storeDeliveryShowAtCheckout,
  doordashEnabled,
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
  localCharge: number | string | null | undefined;
  pickupEnabled: boolean;
  pickupShowAtCheckout: boolean;
  storeDeliveryEnabled: boolean;
  storeDeliveryShowAtCheckout: boolean;
  doordashEnabled: boolean;
}) {
  const router = useRouter();
  const [state, action, pending] = useActionState(saveStoreOrigin, null);
  useEffect(() => {
    if (!state?.saved) return;
    const timer = window.setTimeout(() => router.refresh(), 1800);
    return () => window.clearTimeout(timer);
  }, [state?.saved, router]);
  return (
    <form action={action} className="min-w-0 space-y-4 overflow-x-hidden rounded-2xl bg-white p-5">
      <h2 className="font-semibold text-[#173f35]">Store origin, pickup, and local delivery</h2>
      <p className="text-sm text-[#6b6b6b]">Used as the ship-from / pickup address. UPS and USPS charges are saved in Shipping Rate Manager, not here.</p>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="text-sm">Business/store name<input className="mt-2 min-h-11 w-full min-w-0 rounded-xl border border-[#173f35]/15 px-3" defaultValue={origin.name} name="origin_name" required /></label>
        <label className="text-sm">Contact phone<input className="mt-2 min-h-11 w-full min-w-0 rounded-xl border border-[#173f35]/15 px-3" defaultValue={origin.phone} name="origin_phone" /></label>
        <label className="sm:col-span-2 text-sm">Address line 1<input className="mt-2 min-h-11 w-full min-w-0 rounded-xl border border-[#173f35]/15 px-3" defaultValue={origin.address_line_1} name="origin_address_line_1" required /></label>
        <label className="sm:col-span-2 text-sm">Address line 2<input className="mt-2 min-h-11 w-full min-w-0 rounded-xl border border-[#173f35]/15 px-3" defaultValue={origin.address_line_2} name="origin_address_line_2" /></label>
        <label className="text-sm">City<input className="mt-2 min-h-11 w-full min-w-0 rounded-xl border border-[#173f35]/15 px-3" defaultValue={origin.city} name="origin_city" required /></label>
        <label className="text-sm">State<input className="mt-2 min-h-11 w-full min-w-0 rounded-xl border border-[#173f35]/15 px-3" defaultValue={origin.state} name="origin_state" /></label>
        <label className="text-sm">ZIP / postal code<input className="mt-2 min-h-11 w-full min-w-0 rounded-xl border border-[#173f35]/15 px-3" defaultValue={origin.postal_code} name="origin_postal_code" required /></label>
        <label className="text-sm">Country<input className="mt-2 min-h-11 w-full min-w-0 rounded-xl border border-[#173f35]/15 px-3" defaultValue={origin.country || "US"} name="origin_country" required /></label>
        <label className="text-sm">Ivoire Shop local radius (miles)<input className="mt-2 min-h-11 w-full min-w-0 rounded-xl border border-[#173f35]/15 px-3" defaultValue={radius ?? ""} max="500" min="0" name="doordash_max_radius_miles" step="0.1" type="number" /></label>
        <label className="text-sm">Local delivery charge (USD)<input className="mt-2 min-h-11 w-full min-w-0 rounded-xl border border-[#173f35]/15 px-3" defaultValue={localCharge != null ? String(localCharge) : "0"} min="0" name="store_delivery_charge" step="0.01" type="number" /></label>
      </div>
      <p className="text-xs text-[#6b6b6b]">Radius is an Ivoire Shop business rule. DoorDash quote/serviceability remains authoritative when connected.</p>
      <div className="grid gap-2 text-sm">
        <label className="flex items-center gap-2"><input defaultChecked={pickupEnabled} name="pickup_enabled" type="checkbox" /> Pickup enabled</label>
        <label className="flex items-center gap-2"><input defaultChecked={pickupShowAtCheckout} name="pickup_show_at_checkout" type="checkbox" /> Show pickup at checkout</label>
        <label className="flex items-center gap-2"><input defaultChecked={storeDeliveryEnabled} name="store_delivery_enabled" type="checkbox" /> Local delivery enabled</label>
        <label className="flex items-center gap-2"><input defaultChecked={storeDeliveryShowAtCheckout} name="store_delivery_show_at_checkout" type="checkbox" /> Show local delivery at checkout</label>
        <label className="flex items-center gap-2"><input defaultChecked={doordashEnabled} name="doordash_enabled" type="checkbox" /> DoorDash local delivery (requires credentials)</label>
      </div>
      {state?.error ? <p className="text-sm text-red-800">{state.error}</p> : null}
      {state?.saved && !pending ? <p className="text-sm text-[#173f35]">Settings saved.</p> : null}
      <AdminSaveButton failed={Boolean(state?.error) && !pending} idleLabel="Save origin and local options" pending={pending} saved={Boolean(state?.saved) && !pending} />
    </form>
  );
}
