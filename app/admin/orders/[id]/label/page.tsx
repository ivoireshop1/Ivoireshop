import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAdmin } from "@/src/lib/auth/guards";
import { PrintLabelButton } from "@/src/components/admin/print-label-button";

export default async function UpsLabelPrintPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { supabase } = await requireAdmin();
  const { data } = await supabase
    .from("easyship_label_purchases")
    .select("id")
    .eq("order_id", id)
    .eq("status", "purchased")
    .eq("label_ready", true)
    .order("purchased_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!data) notFound();
  const src = `/api/admin/orders/${id}/easyship-label`;
  return (
    <main className="min-h-screen bg-white p-6 print:p-0">
      <div className="mb-4 flex flex-wrap items-center gap-3 print:hidden">
        <Link className="text-sm text-[#173f35] underline" href={`/admin/orders/${id}`}>Back to order</Link>
        <a className="text-sm font-semibold text-[#173f35] underline" href={`${src}?download=1`}>Download Label</a>
        <PrintLabelButton />
      </div>
      <iframe className="h-[900px] w-full border-0" src={src} title="UPS shipping label" />
    </main>
  );
}
