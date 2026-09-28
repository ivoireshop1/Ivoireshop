import { notFound } from "next/navigation";
import Link from "next/link";
import { requireAdmin } from "@/src/lib/auth/guards";
import { getAdminOrderEmailPreview } from "@/src/lib/admin/email-actions";
import type { OrderEmailEvent } from "@/src/lib/communications/order-messages";

const events: { value: OrderEmailEvent; label: string }[] = [
  { value: "confirmed", label: "Order confirmed" },
  { value: "ready_for_pickup", label: "Ready for pickup" },
  { value: "shipped", label: "Out for delivery" },
  { value: "delivered", label: "Order completed" },
];

export default async function AdminOrderEmailPreviewPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ event?: string }>;
}) {
  await requireAdmin();
  const [{ id }, { event }] = await Promise.all([params, searchParams]);
  const selected = events.some((item) => item.value === event) ? event as OrderEmailEvent : "confirmed";
  let preview;
  try {
    preview = await getAdminOrderEmailPreview(id, selected);
  } catch {
    notFound();
  }
  return (
    <div className="space-y-6">
      <Link className="text-sm text-[#173f35] underline" href={`/admin/orders/${id}`}>Back to order</Link>
      <div>
        <p className="text-[11px] uppercase tracking-[0.2em] text-[#b8964c]">Admin only</p>
        <h1 className="mt-2 text-3xl font-semibold text-[#173f35]">Preview Confirmation Email</h1>
        <p className="mt-2 text-sm text-[#6b6b6b]">This is exactly what the customer would receive for this stored order. No email is sent.</p>
      </div>
      <form className="flex flex-wrap items-end gap-3" method="get">
        <label className="text-sm" htmlFor="email-event">
          Template
          <select className="mt-2 block rounded-xl border border-[#173f35]/15 bg-white px-3 py-2" defaultValue={selected} id="email-event" name="event">
            {events.map((item) => (
              <option key={item.value} value={item.value}>{item.label}</option>
            ))}
          </select>
        </label>
        <button className="min-h-11 rounded-xl bg-[#173f35] px-4 py-2 text-sm text-white" type="submit">Show preview</button>
      </form>
      <p className="break-words text-sm text-[#6b6b6b]"><span className="font-semibold text-[#173f35]">Subject:</span> {preview.subject}</p>
      <iframe className="min-h-[720px] w-full rounded-2xl border border-[#173f35]/10 bg-white" sandbox="" srcDoc={preview.html} title="Customer confirmation email preview" />
      <pre className="overflow-x-auto whitespace-pre-wrap rounded-2xl bg-white p-5 text-sm text-[#173f35]">{preview.text}</pre>
    </div>
  );
}
