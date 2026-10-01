export function CheckoutProgress({ step }: { step: "account" | "shipping" | "payment" | "review" }) {
  const steps = [
    { id: "account", label: "Account", n: 1 },
    { id: "shipping", label: "Shipping", n: 2 },
    { id: "payment", label: "Payment", n: 3 },
    { id: "review", label: "Review", n: 4 },
  ] as const;
  const current = steps.findIndex((item) => item.id === step);
  return (
    <ol className="grid grid-cols-4 gap-1 overflow-hidden sm:gap-2" aria-label="Checkout progress">
      {steps.map((item, index) => {
        const state = index < current ? "done" : index === current ? "current" : "upcoming";
        return (
          <li className="min-w-0 text-center" key={item.id}>
            <div
              aria-current={state === "current" ? "step" : undefined}
              className={`mx-auto flex h-8 w-8 items-center justify-center rounded-full text-xs font-semibold sm:h-9 sm:w-9 ${
                state === "current"
                  ? "bg-forest-green text-white"
                  : state === "done"
                    ? "bg-forest-green/15 text-forest-green"
                    : "bg-white text-muted"
              }`}
            >
              {item.n}
            </div>
            <p className={`mt-1 truncate text-[11px] font-semibold sm:text-xs ${state === "upcoming" ? "text-muted" : "text-forest-green"}`}>
              {item.label}
            </p>
          </li>
        );
      })}
    </ol>
  );
}
