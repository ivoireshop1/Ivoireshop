import { buildOrderTimeline } from "@/src/lib/orders/timeline";

export function OrderTimeline({
  order,
  events = [],
}: {
  order: {
    status: string;
    fulfillment_method: string;
    fulfillment_provider?: string | null;
    created_at: string;
  };
  events?: Array<{ status: string; created_at: string }>;
}) {
  const steps = buildOrderTimeline({ ...order, events });
  return (
    <ol className="mt-4 space-y-3">
      {steps.map((step) => (
        <li className="flex items-start gap-3" key={step.id}>
          <span aria-hidden="true" className={`mt-0.5 flex h-6 w-6 items-center justify-center rounded-full text-xs font-semibold ${step.done ? "bg-forest-green text-white" : "border border-forest-green/30 text-muted"}`}>
            {step.done ? "✓" : step.current ? "●" : "○"}
          </span>
          <div className="min-w-0">
            <p className={`font-medium ${step.current ? "text-forest-green" : "text-forest-green/80"}`}>{step.label}</p>
            {step.at ? <p className="text-xs text-muted">{new Date(step.at).toLocaleString()}</p> : null}
          </div>
        </li>
      ))}
    </ol>
  );
}
