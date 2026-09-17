"use client";

import { useFulfillmentMethod, type FulfillmentMethod } from "@/src/lib/fulfillment/use-fulfillment-method";

type FulfillmentMethodCardsProps = {
  value?: FulfillmentMethod;
  onChange?: (method: FulfillmentMethod) => void;
};

export function FulfillmentMethodCards({ value, onChange }: FulfillmentMethodCardsProps) {
  const [stored, setStored] = useFulfillmentMethod();
  const selected = value ?? stored;

  function select(method: FulfillmentMethod) {
    setStored(method);
    onChange?.(method);
  }

  return (
    <div className="grid gap-4 md:grid-cols-2">
      <FulfillmentCard
        copy="Bring your groceries to your door."
        method="delivery"
        selected={selected === "delivery"}
        title="Delivery"
        onSelect={select}
      />
      <FulfillmentCard
        copy="Pick up your order when it's ready."
        method="local_pickup"
        selected={selected === "local_pickup"}
        title="Pickup"
        onSelect={select}
      />
    </div>
  );
}

function FulfillmentCard({
  method,
  title,
  copy,
  selected,
  onSelect,
}: {
  method: FulfillmentMethod;
  title: string;
  copy: string;
  selected: boolean;
  onSelect: (method: FulfillmentMethod) => void;
}) {
  return (
    <button
      aria-pressed={selected}
      className={`fulfillment-card min-h-[220px] w-full rounded-[26px] border p-5 text-left md:p-6 ${
        selected
          ? "border-forest-green bg-white"
          : "border-black/10 bg-[#f7f3ee] hover:border-forest-green/25"
      }`}
      data-method={method}
      data-selected={selected ? "true" : "false"}
      onClick={() => onSelect(method)}
      type="button"
    >
      <div className="fulfillment-scene">
        <div aria-hidden="true" className="fulfillment-visual">
          {method === "delivery" ? <DeliveryVisual /> : <PickupVisual />}
        </div>
      </div>
      <p className="mt-5 text-xs font-semibold uppercase tracking-[0.18em] text-gold">
        {selected ? "Selected" : "Choose"}
      </p>
      <h3 className="mt-2 text-2xl font-semibold text-forest-green">{title}</h3>
      <p className="mt-2 text-sm leading-6 text-muted">{copy}</p>
    </button>
  );
}

function DeliveryVisual() {
  return (
    <svg className="h-24 w-full overflow-visible" fill="none" viewBox="0 0 220 96">
      <path className="fulfillment-route" d="M28 70 C 70 70, 90 38, 132 38 S 176 62, 192 62" stroke="#b8964c" strokeLinecap="round" strokeWidth="2" />
      <circle cx="28" cy="70" fill="#173f35" r="4" />
      <g className="fulfillment-bag">
        <rect fill="#173f35" height="28" rx="6" width="26" x="18" y="36" />
        <path d="M24 40 V32 C24 26 38 26 38 32 V40" stroke="#f7f3ee" strokeWidth="2" />
        <rect fill="#b8964c" height="6" width="14" x="24" y="48" />
      </g>
      <g className="fulfillment-home">
        <path d="M176 62 L192 50 L208 62 V78 H176 Z" fill="#173f35" />
        <rect fill="#f7f3ee" height="10" width="8" x="188" y="66" />
      </g>
    </svg>
  );
}

function PickupVisual() {
  return (
    <svg className="h-24 w-full overflow-visible" fill="none" viewBox="0 0 220 96">
      <rect fill="#eadbc4" height="18" rx="4" width="120" x="50" y="68" />
      <g className="fulfillment-bag">
        <rect fill="#173f35" height="30" rx="6" width="28" x="86" y="32" />
        <path d="M92 36 V28 C92 22 108 22 108 28 V36" stroke="#f7f3ee" strokeWidth="2" />
        <rect fill="#b8964c" height="6" width="14" x="93" y="46" />
      </g>
      <g className="fulfillment-marker">
        <path d="M156 28 C156 18 170 18 170 28 C170 38 163 46 163 46 S156 38 156 28 Z" fill="#b8964c" />
        <circle cx="163" cy="27" fill="#f7f3ee" r="4" />
      </g>
      <path d="M114 62 C128 54, 142 54, 156 44" stroke="#173f35" strokeDasharray="3 4" strokeLinecap="round" strokeWidth="1.5" />
    </svg>
  );
}
