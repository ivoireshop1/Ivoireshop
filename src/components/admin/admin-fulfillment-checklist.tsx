import { fulfillmentChecklist } from "@/src/lib/orders/ops";

export function AdminFulfillmentChecklist({
  order,
  customerNotified,
}: {
  order: {
    status: string;
    payment_status?: string | null;
    fulfillment_method?: string | null;
    fulfillment_provider?: string | null;
    tracking_number?: string | null;
  };
  customerNotified?: boolean;
}) {
  const items = fulfillmentChecklist(order, { customerNotified });
  return (
    <section className="rounded-2xl bg-white p-5">
      <h2 className="font-semibold text-[#173f35]">Fulfillment checklist</h2>
      <ul className="mt-3 space-y-2">
        {items.map((item) => (
          <li className="flex items-center gap-2 text-sm text-[#173f35]" key={item.id}>
            <span aria-hidden="true">{item.done ? "✓" : "○"}</span>
            <span className={item.done ? "" : "text-[#6b6b6b]"}>{item.label}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
