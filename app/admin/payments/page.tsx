import { requireAdmin } from "@/src/lib/auth/guards";
import { getPaymentReadiness } from "@/src/lib/payments/readiness";

export default async function AdminPaymentsPage() {
  await requireAdmin();
  const payment = getPaymentReadiness();
  return <div className="space-y-6"><h1 className="text-3xl font-semibold text-forest-green">Payments</h1><section className="rounded-2xl bg-white p-6"><h2 className="text-xl font-semibold">Online payment not configured</h2><p className="mt-3 text-muted">{payment.message}</p><p className="mt-3 text-muted">Orders retain their recorded payment status. Creating an order or completing fulfillment does not mark it paid.</p><p className="mt-3 text-muted">A payment provider, merchant account, currency and verified webhook integration are required before online payment can be enabled.</p></section></div>;
}
