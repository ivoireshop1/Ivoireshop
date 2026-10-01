import type { DeliveryOption } from "@/src/lib/delivery/types";
import { shippingMethodCopy } from "@/src/lib/delivery/labels";

export function CheckoutShippingMethods({
  options,
  value,
  onChange,
  busy,
}: {
  options: DeliveryOption[];
  value: string;
  onChange: (option: DeliveryOption) => void;
  busy?: boolean;
}) {
  return (
    <section className="min-w-0">
      <h2 className="text-xl font-semibold text-forest-green">Shipping Method</h2>
      <p className="mt-1 text-sm text-muted">Choose how you want to receive your order</p>
      <div className="mt-4 space-y-3">
        {options.map((option) => {
          const copy = shippingMethodCopy(option);
          const selected = value === option.id;
          return (
            <label
              className={`flex min-h-16 cursor-pointer items-center gap-3 rounded-2xl border px-4 py-3 ${
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
                className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border ${
                  selected ? "border-forest-green" : "border-black/25"
                }`}
              >
                {selected ? <span className="h-2.5 w-2.5 rounded-full bg-forest-green" /> : null}
              </span>
              <span className="min-w-0 flex-1">
                <span className="flex items-start justify-between gap-3">
                  <span className="min-w-0">
                    <span className="flex items-center gap-2 font-semibold text-forest-green">
                      <ShippingIcon provider={option.provider} />
                      <span className="min-w-0 break-words">{copy.title}</span>
                    </span>
                    <span className="mt-0.5 block text-sm text-muted">{copy.subtitle}</span>
                  </span>
                  <span className="shrink-0 whitespace-nowrap text-sm font-semibold tabular-nums text-forest-green">{copy.price}</span>
                </span>
              </span>
            </label>
          );
        })}
        {!options.length && !busy ? <p className="text-sm text-muted">No shipping methods are available yet. Complete your address if you need carrier shipping.</p> : null}
        {busy ? <p className="text-sm text-muted">Updating shipping options...</p> : null}
      </div>
    </section>
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
