"use client";

export type CheckoutPaymentProvider = "square" | "paypal";

export function PaymentMethodCards({
  value,
  onChange,
  squareReady,
  paypalReady,
}: {
  value: CheckoutPaymentProvider | null;
  onChange: (provider: CheckoutPaymentProvider) => void;
  squareReady: boolean;
  paypalReady: boolean;
}) {
  const onlineReady = squareReady || paypalReady;
  return (
    <div className="grid gap-4 md:grid-cols-2">
      <PaymentCard
        disabled={!squareReady}
        interactive={onlineReady}
        selected={value === "square"}
        subtitle={squareReady ? "Pay with card through Square." : "Not configured"}
        title="Square"
        onSelect={() => squareReady && onChange("square")}
      />
      <PaymentCard
        disabled={!paypalReady}
        interactive={onlineReady}
        selected={value === "paypal"}
        subtitle={paypalReady ? "Pay with your PayPal account." : "Not configured"}
        title="PayPal"
        onSelect={() => paypalReady && onChange("paypal")}
      />
    </div>
  );
}

function PaymentCard({
  title,
  subtitle,
  selected,
  disabled,
  interactive,
  onSelect,
}: {
  title: string;
  subtitle: string;
  selected: boolean;
  disabled: boolean;
  interactive: boolean;
  onSelect: () => void;
}) {
  const className = `min-h-[140px] w-full rounded-[26px] border p-5 text-left ${
    selected ? "border-forest-green bg-white" : "border-black/10 bg-[#f7f3ee]"
  } ${disabled ? "opacity-70" : "hover:border-forest-green/25"}`;

  if (!interactive) {
    return (
      <div className={className}>
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-gold">Payment</p>
        <p className="mt-3 text-2xl font-semibold text-forest-green">{title}</p>
        <p className="mt-2 text-sm text-muted">{subtitle}</p>
      </div>
    );
  }

  return (
    <button
      aria-pressed={selected}
      className={`${className} ${disabled ? "cursor-not-allowed" : ""}`}
      disabled={disabled}
      type="button"
      onClick={onSelect}
    >
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-gold">Payment</p>
      <p className="mt-3 text-2xl font-semibold text-forest-green">{title}</p>
      <p className="mt-2 text-sm text-muted">{subtitle}</p>
    </button>
  );
}
