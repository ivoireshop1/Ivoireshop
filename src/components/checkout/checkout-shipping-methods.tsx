"use client";

import { useEffect, useId, useMemo, useState } from "react";
import { formatOriginLines, type StoreOrigin } from "@/src/lib/delivery/origin";
import type { DeliveryOption } from "@/src/lib/delivery/types";
import { shippingMethodCopy } from "@/src/lib/delivery/labels";

type CarrierKey = "ups" | "usps";

const CARRIER_META: Record<CarrierKey, { title: string; hint: string }> = {
  ups: { title: "UPS", hint: "Tap to view available shipping options" },
  usps: { title: "USPS", hint: "Tap to view available shipping options" },
};

export function CheckoutShippingMethods({
  options,
  value,
  onChange,
  busy,
  pickupOrigin,
  message,
  expectedLiveCarriers = [],
  temporaryBusyCarriers = [],
}: {
  options: DeliveryOption[];
  value: string;
  onChange: (option: DeliveryOption) => void;
  busy?: boolean;
  pickupOrigin?: StoreOrigin | null;
  message?: string | null;
  /** Carriers enabled for live Shippo quotes — always show accordion even when Shippo returns no rates. */
  expectedLiveCarriers?: Array<"ups" | "usps">;
  /** Carriers that hit a temporary API limit — must not display as permanently Unavailable. */
  temporaryBusyCarriers?: Array<"ups" | "usps">;
}) {
  const pickupLines = formatOriginLines(pickupOrigin ?? undefined);
  const baseId = useId();

  const { ups, usps, other } = useMemo(() => {
    const upsOpts: DeliveryOption[] = [];
    const uspsOpts: DeliveryOption[] = [];
    const otherOpts: DeliveryOption[] = [];
    for (const option of options) {
      if (option.provider === "ups") upsOpts.push(option);
      else if (option.provider === "usps") uspsOpts.push(option);
      else otherOpts.push(option);
    }
    return { ups: upsOpts, usps: uspsOpts, other: otherOpts };
  }, [options]);

  const showUps = ups.length > 0 || expectedLiveCarriers.includes("ups");
  const showUsps = usps.length > 0 || expectedLiveCarriers.includes("usps");

  const selectedCarrier: CarrierKey | null = useMemo(() => {
    const selected = options.find((option) => option.id === value);
    if (selected?.provider === "ups" || selected?.provider === "usps") return selected.provider;
    return null;
  }, [options, value]);

  const [expanded, setExpanded] = useState<CarrierKey | null>(null);

  useEffect(() => {
    if (selectedCarrier) setExpanded(selectedCarrier);
  }, [selectedCarrier]);

  function toggleCarrier(carrier: CarrierKey) {
    setExpanded((current) => (current === carrier ? null : carrier));
  }

  return (
    <section className="min-w-0">
      <h2 className="text-xl font-semibold text-forest-green">Choose your shipping method</h2>
      <p className="mt-1 text-sm text-muted">
        {showUps || showUsps
          ? "Select a carrier, then pick a service with a live quote for your address"
          : "Choose how you want to receive your order"}
      </p>
      <div className="mt-4 space-y-3">
        {showUps ? (
          <CarrierAccordion
            baseId={`${baseId}-ups`}
            carrier="ups"
            expanded={expanded === "ups"}
            onToggle={() => toggleCarrier("ups")}
            options={ups}
            temporaryBusy={temporaryBusyCarriers.includes("ups")}
            unavailableMessage="UPS is unavailable for this destination and parcel. Shippo did not return a UPS test rate. USPS and store options below are still available when listed."
            value={value}
            onChange={onChange}
          />
        ) : null}
        {showUsps ? (
          <CarrierAccordion
            baseId={`${baseId}-usps`}
            carrier="usps"
            expanded={expanded === "usps"}
            onToggle={() => toggleCarrier("usps")}
            options={usps}
            temporaryBusy={temporaryBusyCarriers.includes("usps")}
            unavailableMessage="USPS is unavailable for this destination and parcel. Shippo did not return a USPS test rate."
            value={value}
            onChange={onChange}
          />
        ) : null}

        {other.map((option) => {
          const copy = shippingMethodCopy(option);
          const selected = value === option.id;
          const pickup = option.provider === "pickup";
          return (
            <label
              className={`grid min-h-16 cursor-pointer grid-cols-[1.25rem_minmax(0,1fr)_auto] items-start gap-x-3 rounded-2xl border px-3 py-3 sm:px-4 ${
                selected ? "border-forest-green bg-forest-green/[0.06]" : "border-black/10 bg-white"
              }`}
              key={option.id}
            >
              <input
                checked={selected}
                className="sr-only"
                onChange={() => onChange(option)}
                type="radio"
                value={option.id}
              />
              <span
                aria-hidden="true"
                className={`mt-0.5 flex h-5 w-5 items-center justify-center rounded-full border ${
                  selected ? "border-forest-green" : "border-black/25"
                }`}
              >
                {selected ? <span className="h-2.5 w-2.5 rounded-full bg-forest-green" /> : null}
              </span>
              <span className="min-w-0">
                <span className="flex items-center gap-2 font-semibold text-forest-green">
                  <ShippingIcon provider={option.provider} />
                  <span className="min-w-0 break-words">{copy.title}</span>
                </span>
                <span className="mt-0.5 block text-sm text-muted">{copy.subtitle}</span>
                {pickup && selected && pickupLines.length ? (
                  <span className="mt-3 block rounded-xl bg-white/80 px-3 py-2 text-sm text-forest-green">
                    <span className="block font-semibold">Pickup at Ivoire Shop</span>
                    <span className="mt-1 block whitespace-pre-line text-muted">{pickupLines.join("\n")}</span>
                  </span>
                ) : null}
              </span>
              <span className="shrink-0 self-start whitespace-nowrap pt-0.5 text-sm font-semibold tabular-nums text-forest-green">{copy.price}</span>
            </label>
          );
        })}

        {message && !busy ? <p className="text-sm text-[#7c5d1a]" role="status">{message}</p> : null}
        {!options.length && !busy ? (
          <p className="text-sm text-muted" role="status">
            No shipping methods are available yet. Complete your address if you need carrier shipping.
          </p>
        ) : null}
        {busy ? (
          <p className="text-sm text-muted" role="status" aria-live="polite">
            Updating shipping options…
          </p>
        ) : null}
      </div>
    </section>
  );
}

function CarrierAccordion({
  carrier,
  options,
  expanded,
  onToggle,
  value,
  onChange,
  baseId,
  unavailableMessage,
  temporaryBusy = false,
}: {
  carrier: CarrierKey;
  options: DeliveryOption[];
  expanded: boolean;
  onToggle: () => void;
  value: string;
  onChange: (option: DeliveryOption) => void;
  baseId: string;
  unavailableMessage?: string;
  temporaryBusy?: boolean;
}) {
  const meta = CARRIER_META[carrier];
  const panelId = `${baseId}-panel`;
  const buttonId = `${baseId}-button`;
  const selectedInCarrier = options.some((option) => option.id === value)
    || value.startsWith(`${carrier}:`);
  const selectedOption = options.find((option) => option.id === value);
  const selectedCopy = selectedOption ? shippingMethodCopy(selectedOption) : null;
  // Never label a rate-limited / pinned selection as permanently unavailable when empty this pass.
  const unavailable = !options.length && !temporaryBusy && !value.startsWith(`${carrier}:`);
  const keepSelectionBusy = temporaryBusy || (value.startsWith(`${carrier}:`) && !options.length);

  return (
    <div
      className={`overflow-hidden rounded-2xl border transition-[border-color,box-shadow] duration-200 ${
        selectedInCarrier || expanded
          ? "border-forest-green bg-forest-green/[0.04] shadow-[0_8px_24px_rgba(23,63,53,0.06)]"
          : unavailable
            ? "border-black/10 bg-[#fbfaf7]"
            : "border-black/10 bg-white"
      }`}
    >
      <button
        aria-controls={panelId}
        aria-expanded={expanded}
        className="flex w-full items-center gap-3 px-3 py-3 text-left sm:px-4"
        id={buttonId}
        onClick={onToggle}
        type="button"
      >
        <span
          aria-hidden="true"
          className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border ${
            selectedInCarrier ? "border-forest-green/40 bg-white text-forest-green" : "border-black/10 bg-[#f7f4ee] text-forest-green"
          }`}
        >
          <ShippingIcon provider={carrier} />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block font-semibold text-forest-green">{meta.title}</span>
          <span className="mt-0.5 block text-sm text-muted">
            {selectedCopy && selectedOption
              ? `${serviceTitle(selectedOption)} · ${selectedCopy.price}`
              : keepSelectionBusy
                ? "Temporarily busy — your selection is kept"
                : unavailable
                  ? "Unavailable for this destination"
                  : meta.hint}
          </span>
        </span>
        <span
          aria-hidden="true"
          className={`shrink-0 text-forest-green transition-transform duration-200 ${expanded ? "rotate-180" : ""}`}
        >
          <ChevronIcon />
        </span>
      </button>

      <div
        className={`grid transition-[grid-template-rows] duration-200 ease-out ${expanded ? "grid-rows-[1fr]" : "grid-rows-[0fr]"}`}
        id={panelId}
        role="region"
        aria-labelledby={buttonId}
      >
        <div className="min-h-0 overflow-hidden" inert={!expanded ? true : undefined}>
          <div className="space-y-2 border-t border-black/8 px-3 py-3 sm:px-4" hidden={!expanded}>
            {!options.length ? (
              <p className="text-sm text-[#7c5d1a]" role="status">
                {keepSelectionBusy
                  ? `${meta.title} rates are temporarily busy. If you already selected a ${meta.title} service, it is kept — wait a moment or continue to payment.`
                  : (unavailableMessage || `No ${meta.title} services are available for this address.`)}
              </p>
            ) : (
              options.map((option) => {
                const copy = shippingMethodCopy(option);
                const selected = value === option.id;
                const title = serviceTitle(option);
                return (
                  <label
                    className={`grid min-h-14 cursor-pointer grid-cols-[1.25rem_minmax(0,1fr)_auto] items-start gap-x-3 rounded-xl border px-3 py-2.5 ${
                      selected ? "border-forest-green bg-white" : "border-black/8 bg-white/80"
                    }`}
                    key={option.id}
                  >
                    <input
                      checked={selected}
                      className="sr-only"
                      onChange={() => onChange(option)}
                      type="radio"
                      value={option.id}
                    />
                    <span
                      aria-hidden="true"
                      className={`mt-0.5 flex h-5 w-5 items-center justify-center rounded-full border ${
                        selected ? "border-forest-green" : "border-black/25"
                      }`}
                    >
                      {selected ? <span className="h-2.5 w-2.5 rounded-full bg-forest-green" /> : null}
                    </span>
                    <span className="min-w-0">
                      <span className="block font-medium text-forest-green">{title}</span>
                      {option.estimate ? <span className="mt-0.5 block text-sm text-muted">{option.estimate}</span> : null}
                    </span>
                    <span className="shrink-0 self-start whitespace-nowrap pt-0.5 text-sm font-semibold tabular-nums text-forest-green">
                      {copy.price}
                    </span>
                  </label>
                );
              })
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function serviceTitle(option: DeliveryOption) {
  const label = option.label?.trim() || "";
  const parts = label.split("·").map((part) => part.trim()).filter(Boolean);
  if (parts.length >= 2) return parts.slice(1).join(" · ");
  if (option.serviceCode) return option.serviceCode;
  return label || "Shipping service";
}

function ChevronIcon() {
  return (
    <svg aria-hidden="true" className="h-5 w-5" fill="none" viewBox="0 0 24 24">
      <path d="m6 9 6 6 6-6" stroke="currentColor" strokeLinecap="round" strokeWidth="1.8" />
    </svg>
  );
}

function ShippingIcon({ provider }: { provider: string }) {
  const className = "h-4 w-4 shrink-0";
  if (provider === "pickup") {
    return (
      <svg aria-hidden="true" className={className} fill="none" viewBox="0 0 24 24">
        <path d="M4 10.5 12 4l8 6.5V20H4V10.5Z" stroke="currentColor" strokeWidth="1.6" />
      </svg>
    );
  }
  if (provider === "usps" || provider === "ups") {
    return (
      <svg aria-hidden="true" className={className} fill="none" viewBox="0 0 24 24">
        <rect height="12" rx="2" stroke="currentColor" strokeWidth="1.6" width="14" x="3" y="7" />
        <path d="M17 10h4v7h-4" stroke="currentColor" strokeWidth="1.6" />
      </svg>
    );
  }
  return (
    <svg aria-hidden="true" className={className} fill="none" viewBox="0 0 24 24">
      <path d="M3 7h11v10H3V7Zm11 3h5l2 3v4h-7V10Z" stroke="currentColor" strokeWidth="1.6" />
    </svg>
  );
}
