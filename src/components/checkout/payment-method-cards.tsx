export function PaymentMethodCards({
  stripeReady,
}: {
  stripeReady: boolean;
}) {
  return (
    <div className="rounded-2xl border border-forest-green bg-white px-4 py-3">
      <p className="font-semibold text-forest-green">Secure payment powered by Stripe</p>
      <p className="mt-1 text-sm text-muted">
        {stripeReady ? "Card details are collected by Stripe on this page." : "Stripe keys are not configured on the server yet."}
      </p>
    </div>
  );
}
