import { requireAdmin } from "@/src/lib/auth/guards";
import { getPaymentReadiness } from "@/src/lib/payments/readiness";
import { getEmailProviderStatus } from "@/src/lib/email/send";

export default async function AdminPaymentsPage() {
  await requireAdmin();
  const payment = getPaymentReadiness();
  const email = getEmailProviderStatus();
  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-semibold text-forest-green">Payments</h1>
      <section className="rounded-2xl bg-white p-6">
        <h2 className="text-xl font-semibold">Provider status</h2>
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <div className="rounded-2xl border border-[#173f35]/10 p-4">
            <p className="font-semibold text-[#173f35]">Square</p>
            <p className="mt-2 text-sm text-muted">{payment.square.label}</p>
          </div>
          <div className="rounded-2xl border border-[#173f35]/10 p-4">
            <p className="font-semibold text-[#173f35]">PayPal</p>
            <p className="mt-2 text-sm text-muted">{payment.paypal.label}</p>
          </div>
        </div>
        {!payment.canRecord ? (
          <p className="mt-4 text-sm text-muted">Order payment updates require a server-only Supabase service role key. Never put that key in browser code.</p>
        ) : null}
        <p className="mt-4 text-sm text-muted">{payment.message}</p>
        <p className="mt-3 text-sm text-muted">Sandbox first. Set SQUARE_ENVIRONMENT and PAYPAL_ENVIRONMENT to production only after sandbox QA. Charged amounts always come from the store-confirmed order total.</p>
      </section>
      <section className="rounded-2xl bg-white p-6">
        <h2 className="text-xl font-semibold">Order emails</h2>
        <p className="mt-3 text-sm text-muted">
          {email.configured ? `Transactional email is configured (${email.provider}).` : "No email provider is configured. Orders still succeed if email cannot be sent."}
        </p>
      </section>
    </div>
  );
}
