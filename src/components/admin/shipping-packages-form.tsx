"use client";

import { useActionState, useMemo, useState } from "react";
import { saveShippingPackages } from "@/src/lib/delivery/actions";
import type { ShippingPackagePreset } from "@/src/lib/shipping/packages";

function emptyPackage(): ShippingPackagePreset {
  return {
    id: crypto.randomUUID(),
    name: "",
    lengthIn: 0,
    widthIn: 0,
    heightIn: 0,
    maxWeightLb: 0,
    tareWeightLb: 0,
    isActive: true,
  };
}

export function ShippingPackagesForm({
  packages,
  defaultPackageId,
}: {
  packages: ShippingPackagePreset[];
  defaultPackageId?: string | null;
}) {
  const [rows, setRows] = useState<ShippingPackagePreset[]>(packages.length ? packages : [emptyPackage()]);
  const [defaultId, setDefaultId] = useState(defaultPackageId ?? "");
  const [state, action, pending] = useActionState(saveShippingPackages, null);
  const payload = useMemo(() => JSON.stringify(rows.map((row) => ({
    id: row.id,
    name: row.name,
    length_in: row.lengthIn,
    width_in: row.widthIn,
    height_in: row.heightIn,
    max_weight_lb: row.maxWeightLb,
    tare_weight_lb: row.tareWeightLb,
    is_active: row.isActive,
  }))), [rows]);

  function update(id: string, patch: Partial<ShippingPackagePreset>) {
    setRows((current) => current.map((row) => row.id === id ? { ...row, ...patch } : row));
  }

  return (
    <form action={action} className="min-w-0 space-y-4 overflow-x-hidden rounded-2xl bg-white p-5">
      <h2 className="font-semibold text-[#173f35]">Shipping package presets</h2>
      <p className="text-sm text-[#6b6b6b]">
        Save measured boxes here. Products can use a preset instead of repeating length, width, and height.
        Enter verified box dimensions and a real max weight. Nothing is invented, and postage stays off.
      </p>
      <input name="packages_json" type="hidden" value={payload} />
      <div className="space-y-4">
        {rows.map((row) => (
          <fieldset key={row.id} className="grid gap-3 rounded-xl border border-[#173f35]/10 p-3 sm:grid-cols-6">
            <legend className="px-1 text-sm font-medium text-[#173f35]">{row.name || "New package"}</legend>
            <label className="text-sm sm:col-span-2">
              Name
              <input className="mt-1 min-h-11 w-full rounded-xl border border-[#173f35]/15 px-3" onChange={(event) => update(row.id, { name: event.target.value })} value={row.name} />
            </label>
            <label className="text-sm">Length (in)<input className="mt-1 min-h-11 w-full rounded-xl border border-[#173f35]/15 px-3" min="0" onChange={(event) => update(row.id, { lengthIn: Number(event.target.value) })} step="0.1" type="number" value={row.lengthIn || ""} /></label>
            <label className="text-sm">Width (in)<input className="mt-1 min-h-11 w-full rounded-xl border border-[#173f35]/15 px-3" min="0" onChange={(event) => update(row.id, { widthIn: Number(event.target.value) })} step="0.1" type="number" value={row.widthIn || ""} /></label>
            <label className="text-sm">Height (in)<input className="mt-1 min-h-11 w-full rounded-xl border border-[#173f35]/15 px-3" min="0" onChange={(event) => update(row.id, { heightIn: Number(event.target.value) })} step="0.1" type="number" value={row.heightIn || ""} /></label>
            <label className="text-sm">Max weight (lb)<input className="mt-1 min-h-11 w-full rounded-xl border border-[#173f35]/15 px-3" min="0" onChange={(event) => update(row.id, { maxWeightLb: Number(event.target.value) })} step="0.01" type="number" value={row.maxWeightLb || ""} /></label>
            <label className="text-sm">Box tare (lb)<input className="mt-1 min-h-11 w-full rounded-xl border border-[#173f35]/15 px-3" min="0" onChange={(event) => update(row.id, { tareWeightLb: Number(event.target.value) })} step="0.01" type="number" value={row.tareWeightLb || ""} /></label>
            <label className="flex items-center gap-2 text-sm sm:col-span-2">
              <input checked={row.isActive} onChange={(event) => update(row.id, { isActive: event.target.checked })} type="checkbox" />
              Active
            </label>
          </fieldset>
        ))}
      </div>
      <button className="min-h-11 rounded-xl border border-[#173f35]/20 px-4 py-2 text-sm" onClick={() => setRows((current) => [...current, emptyPackage()])} type="button">
        Add package
      </button>
      <label className="block text-sm">
        Default package for assigned products
        <select className="mt-2 min-h-11 w-full rounded-xl border border-[#173f35]/15 px-3" name="default_shipping_package_id" onChange={(event) => setDefaultId(event.target.value)} value={defaultId}>
          <option value="">None — products must have their own box or measurements</option>
          {rows.filter((row) => row.isActive && row.name).map((row) => (
            <option key={row.id} value={row.id}>{row.name}</option>
          ))}
        </select>
      </label>
      {state?.error ? <p className="text-sm text-red-800">{state.error}</p> : null}
      {state?.saved && !pending ? <p className="text-sm text-[#173f35]">Shipping packages saved.</p> : null}
      <button className="min-h-11 rounded-xl bg-[#173f35] px-4 py-2 text-sm text-white disabled:opacity-70" disabled={pending} type="submit">
        {pending ? "Saving…" : "Save packages"}
      </button>
    </form>
  );
}
