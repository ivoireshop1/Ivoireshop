export function PaymentMethodCards({
  demoEnabled,
  method,
  stripeReady,
  onChange,
}: {
  demoEnabled: boolean;
  method: "demo" | "stripe" | "";
  stripeReady: boolean;
  onChange: (method: "demo" | "stripe") => void;
}) {
  return (
    <div className="space-y-3">
      {demoEnabled ? (
        <label className={`block cursor-pointer rounded-2xl border px-4 py-3 ${method === "demo" ? "border-forest-green bg-white" : "border-black/10 bg-white/70"}`}>
          <input
            checked={method === "demo"}
            className="sr-only"
            name="paymentMethod"
            onChange={() => onChange("demo")}
            type="radio"
            value="demo"
          />
          <p className="font-semibold text-forest-green">Demo Payment — No real charge</p>
          <p className="mt-1 text-sm text-muted">This is a demonstration. No real payment will be collected.</p>
        </label>
      ) : (
      <label className={`block cursor-pointer rounded-2xl border px-4 py-3 ${method === "stripe" ? "border-forest-green bg-white" : "border-black/10 bg-white/70"}`}>
        <input
          checked={method === "stripe"}
          className="sr-only"
          name="paymentMethod"
          onChange={() => onChange("stripe")}
          type="radio"
          value="stripe"
        />
        <p className="font-semibold text-forest-green">Stripe Card Payment</p>
        <p className="mt-1 text-sm text-muted">
          {stripeReady ? "Card details are collected by Stripe on this page." : "Stripe keys are not configured on the server yet."}
        </p>
      </label>
      )}
    </div>
  );
}
