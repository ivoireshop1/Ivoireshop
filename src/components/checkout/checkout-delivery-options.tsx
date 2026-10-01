"use client";

import { useState } from "react";
import { getCheckoutDeliveryOptions } from "@/src/lib/delivery/actions";
import type { DeliveryOption } from "@/src/lib/delivery/types";

export function CheckoutDeliveryOptions({
  fulfillmentMethod,
  items,
  value,
  onChange,
}: {
  fulfillmentMethod: "delivery" | "local_pickup";
  items: { product_id: string; quantity: number }[];
  value: string;
  onChange: (id: string) => void;
}) {
  const [options, setOptions] = useState<DeliveryOption[]>([]);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  async function refresh(form: HTMLFormElement | null) {
    setBusy(true);
    const data = new FormData(form ?? undefined);
    const address = {
      address_line_1: String(data.get("addressLine1") ?? "").trim(),
      city: String(data.get("city") ?? "").trim(),
      state: String(data.get("state") ?? "").trim(),
      postal_code: String(data.get("postalCode") ?? "").trim(),
      country: String(data.get("country") ?? "").trim(),
    };
    const result = await getCheckoutDeliveryOptions({ address, items });
    const visible = result.options.filter((option) => option.fulfillmentMethod === fulfillmentMethod);
    setOptions(visible);
    setMessage(result.message ?? "");
    if (visible.length && !visible.some((option) => option.id === value)) onChange(visible[0].id);
    setBusy(false);
  }

  return (
    <div className="space-y-3">
      <button
        className="min-h-11 rounded-xl border border-forest-green/20 px-4 py-2 text-sm font-medium text-forest-green disabled:opacity-60"
        disabled={busy}
        type="button"
        onClick={(event) => void refresh(event.currentTarget.form)}
      >
        {busy ? "Checking delivery..." : fulfillmentMethod === "local_pickup" ? "Show pickup options" : "Get delivery options"}
      </button>
      {options.map((option) => (
        <label className="flex min-h-11 cursor-pointer items-start gap-3 rounded-xl border border-black/10 bg-white p-3" key={option.id}>
          <input checked={value === option.id} className="mt-1" name="deliveryOptionId" onChange={() => onChange(option.id)} type="radio" value={option.id} />
          <span className="min-w-0">
            <span className="block break-words font-medium text-forest-green">{option.label}</span>
            <span className="block text-sm text-muted">${option.amount.toFixed(2)}{option.estimate ? ` · ${option.estimate}` : ""}</span>
          </span>
        </label>
      ))}
      {message ? <p className="text-sm text-muted">{message}</p> : null}
    </div>
  );
}
