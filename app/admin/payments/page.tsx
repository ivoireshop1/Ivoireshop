import Link from "next/link";
import { requireAdmin } from "@/src/lib/auth/guards";
import { getPaymentReadiness } from "@/src/lib/payments/readiness";
import { getEmailProviderStatus } from "@/src/lib/email/send";
import { sendAdminTestEmail } from "@/src/lib/admin/email-actions";
import { TaxSettingsForm } from "@/src/components/admin/tax-settings-form";
import { STORE_SETTINGS_ID } from "@/src/lib/store/constants";
import { parseTaxMode, taxModeLabel } from "@/src/lib/tax/totals";
import { getStripeConfig } from "@/src/lib/payments/stripe-config";
import { formatStoreDateTime } from "@/src/lib/store/timezone";
import { paymentStatusLabel } from "@/src/lib/orders/status";

export default async function AdminPaymentsPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; success?: string }>;
}) {
  const { supabase } = await requireAdmin();
  const notices = await searchParams;
  const payment = getPaymentReadiness();
  const stripe = getStripeConfig();
  const email = getEmailProviderStatus();
  const [{ data: settings }, { data: health }, { data: recentPaid }, { data: recentFailed }, { data: recentRefunds }] = await Promise.all([
    supabase.from("store_settings").select("tax_mode, tax_rate_percent, tax_applies_to_shipping, tax_name").eq("id", STORE_SETTINGS_ID).maybeSingle(),
    supabase.from("payment_webhook_health").select("last_success_at, last_error_at, last_error_code, recent_failures").eq("provider", "stripe").maybeSingle(),
    supabase.from("orders").select("id, order_number, customer_name, total, payment_status, created_at").eq("payment_provider", "stripe").eq("payment_status", "paid").order("paid_at", { ascending: false }).limit(5),
    supabase.from("orders").select("id, order_number, customer_name, total, payment_status, created_at").eq("payment_provider", "stripe").eq("payment_status", "failed").order("updated_at", { ascending: false }).limit(5),
    supabase.from("orders").select("id, order_number, customer_name, total, refunded_amount, payment_status, created_at").in("payment_status", ["refunded", "partially_refunded"]).order("updated_at", { ascending: false }).limit(5),
  ]);
  const taxMode = parseTaxMode(settings?.tax_mode);
  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-semibold text-forest-green">Payments & Tax</h1>
      {notices.error === "email_not_configured" ? <p className="rounded-xl bg-red-50 p-3 text-sm text-red-800">Email provider not configured.</p> : null}
      {notices.error === "invalid_test_recipient" ? <p className="rounded-xl bg-red-50 p-3 text-sm text-red-800">Enter a valid test recipient email.</p> : null}
      {notices.error === "test_email_failed" ? <p className="rounded-xl bg-red-50 p-3 text-sm text-red-800">The test email could not be sent.</p> : null}
      {notices.success === "test_email_sent" ? <p className="rounded-xl bg-[#173f35]/5 p-3 text-sm text-[#173f35]">Test email sent. This did not change any order or payment status.</p> : null}
      <section className="rounded-2xl bg-white p-6">
        <h2 className="text-xl font-semibold">Stripe</h2>
        <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
          <div><dt className="text-[#6b6b6b]">Stripe</dt><dd className="font-semibold text-[#173f35]">{payment.stripe.canCollect ? "Configured" : "Not Configured"}</dd></div>
          <div><dt className="text-[#6b6b6b]">Mode</dt><dd className="font-semibold text-[#173f35]">{payment.stripe.mode === "live" ? "LIVE" : payment.stripe.mode === "test" ? "TEST" : "—"}</dd></div>
          <div><dt className="text-[#6b6b6b]">Publishable configuration</dt><dd className="font-semibold text-[#173f35]">{payment.stripe.publishable === "available" ? "Available" : "Missing"}</dd></div>
          <div><dt className="text-[#6b6b6b]">Server configuration</dt><dd className="font-semibold text-[#173f35]">{payment.stripe.server === "available" ? "Available" : "Missing"}</dd></div>
          <div><dt className="text-[#6b6b6b]">Webhook</dt><dd className="font-semibold text-[#173f35]">{!payment.stripe.webhook || payment.stripe.webhook === "missing" ? "Missing" : health?.last_error_at && (!health.last_success_at || health.last_error_at > health.last_success_at) ? "Error" : health?.last_success_at ? "Configured" : "Configured"}</dd></div>
          <div><dt className="text-[#6b6b6b]">Last webhook</dt><dd className="text-[#173f35]">{health?.last_success_at ? formatStoreDateTime(health.last_success_at) : "None yet"}</dd></div>
        </dl>
        {payment.stripe.modeMismatch ? <p className="mt-4 text-sm text-red-800">Publishable and secret keys are not the same Stripe mode.</p> : null}
        {payment.stripe.missing.length ? <p className="mt-4 text-sm text-[#7c5d1a]">Missing: {payment.stripe.missing.join(", ")}.</p> : null}
        <p className="mt-4 text-sm text-muted">Server environment names: {stripe.envNames.join(", ")}. Never paste secret keys into chat or the browser.</p>
        <p className="mt-2 text-sm text-muted">Webhook endpoint: /api/payments/stripe/webhook</p>
        {!payment.canRecord ? (
          <p className="mt-4 text-sm text-muted">Order payment updates require a server-only Supabase service role key.</p>
        ) : null}
        <p className="mt-4 text-sm text-muted">{payment.message}</p>
      </section>
      <section className="rounded-2xl bg-white p-6">
        <h2 className="text-xl font-semibold">Payment operations</h2>
        <div className="mt-4 grid gap-4 lg:grid-cols-3">
          <OpsList hrefBase="/admin/orders/" rows={recentPaid} title="Recent paid" />
          <OpsList hrefBase="/admin/orders/" rows={recentFailed} title="Recent failures" />
          <OpsList hrefBase="/admin/orders/" rows={recentRefunds} title="Refunds" refund />
        </div>
      </section>
      <TaxSettingsForm
        appliesToShipping={Boolean(settings?.tax_applies_to_shipping)}
        taxMode={settings?.tax_mode}
        taxName={settings?.tax_name}
        taxRate={settings?.tax_rate_percent}
      />
      {taxMode === "not_configured" ? (
        <p className="rounded-xl border border-[#b8964c]/40 bg-white p-4 text-sm text-[#7c5d1a]">Tax collection has not been configured for this store.</p>
      ) : (
        <p className="text-sm text-[#6b6b6b]">Tax: {taxModeLabel(taxMode)}{taxMode === "manual_rate" && settings?.tax_rate_percent != null ? ` · ${settings.tax_rate_percent}%` : ""}</p>
      )}
      <section className="rounded-2xl bg-white p-6">
        <h2 className="text-xl font-semibold">Order emails</h2>
        <p className="mt-3 text-sm text-muted">
          {email.configured
            ? `Transactional email is configured (${email.provider}).`
            : "Email provider not configured. Orders still succeed if email cannot be sent."}
        </p>
        <p className="mt-2 text-sm text-muted">
          Recommended later: Resend, with server-only {email.recommendedVars.join(" and ")}. Postmark and SendGrid remain compatible.
        </p>
        <p className="mt-4 text-sm text-muted">
          Preview uses a real stored order.{" "}
          <Link className="font-semibold text-forest-green underline underline-offset-4" href="/admin/orders">
            Open Orders
          </Link>
          {" "}and choose Preview Confirmation Email. No email is sent from preview.
        </p>
        <form action={sendAdminTestEmail} className="mt-6 space-y-3 rounded-2xl border border-[#173f35]/10 p-4">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-gold">TEST</p>
          <h3 className="font-semibold text-[#173f35]">Send Test Email</h3>
          <p className="text-sm text-muted">Admin only. Enter a recipient you control. This does not create an order or change payment status.</p>
          <label className="block text-sm" htmlFor="test-recipient">
            Recipient email
            <input className="mt-2 w-full rounded-xl border px-3 py-2" id="test-recipient" name="recipient" required type="email" />
          </label>
          <button
            className="min-h-11 rounded-xl bg-[#173f35] px-4 py-2 text-sm text-white disabled:cursor-not-allowed disabled:opacity-50"
            disabled={!email.configured}
            type="submit"
          >
            Send Test Email
          </button>
          {!email.configured ? <p className="text-sm text-muted">Email provider not configured.</p> : null}
        </form>
      </section>
    </div>
  );
}

function OpsList({
  title,
  rows,
  hrefBase,
  refund,
}: {
  title: string;
  hrefBase: string;
  refund?: boolean;
  rows: Array<{ id: string; order_number: string; customer_name?: string | null; total: number | string; payment_status: string; refunded_amount?: number | string | null }> | null;
}) {
  return (
    <div>
      <h3 className="font-semibold text-[#173f35]">{title}</h3>
      <ul className="mt-3 space-y-2 text-sm">
        {!rows?.length ? <li className="text-[#6b6b6b]">None yet</li> : rows.map((row) => (
          <li key={row.id}>
            <Link className="text-[#173f35] underline" href={`${hrefBase}${row.id}`}>
              {row.order_number}
            </Link>
            <span className="text-[#6b6b6b]"> · {row.customer_name || "Customer"} · ${Number(refund ? row.refunded_amount ?? row.total : row.total).toFixed(2)} · {paymentStatusLabel(row.payment_status)}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
