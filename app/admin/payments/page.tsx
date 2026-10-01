import Link from "next/link";
import { requireAdmin } from "@/src/lib/auth/guards";
import { getPaymentReadiness } from "@/src/lib/payments/readiness";
import { getEmailProviderStatus } from "@/src/lib/email/send";
import { sendAdminTestEmail } from "@/src/lib/admin/email-actions";
import { TaxSettingsForm } from "@/src/components/admin/tax-settings-form";
import { STORE_SETTINGS_ID } from "@/src/lib/store/constants";
import { createClient } from "@/src/lib/supabase/server";
import { parseTaxMode, taxModeLabel } from "@/src/lib/tax/totals";

export default async function AdminPaymentsPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; success?: string }>;
}) {
  await requireAdmin();
  const notices = await searchParams;
  const payment = getPaymentReadiness();
  const email = getEmailProviderStatus();
  const supabase = await createClient();
  const { data: settings } = await supabase.from("store_settings").select("tax_mode, tax_rate_percent, tax_applies_to_shipping, tax_name").eq("id", STORE_SETTINGS_ID).maybeSingle();
  const taxMode = parseTaxMode(settings?.tax_mode);
  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-semibold text-forest-green">Payments</h1>
      {notices.error === "email_not_configured" ? <p className="rounded-xl bg-red-50 p-3 text-sm text-red-800">Email provider not configured.</p> : null}
      {notices.error === "invalid_test_recipient" ? <p className="rounded-xl bg-red-50 p-3 text-sm text-red-800">Enter a valid test recipient email.</p> : null}
      {notices.error === "test_email_failed" ? <p className="rounded-xl bg-red-50 p-3 text-sm text-red-800">The test email could not be sent.</p> : null}
      {notices.success === "test_email_sent" ? <p className="rounded-xl bg-[#173f35]/5 p-3 text-sm text-[#173f35]">Test email sent. This did not change any order or payment status.</p> : null}
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
        <p className="mt-3 text-sm text-muted">Sandbox first. Set SQUARE_ENVIRONMENT and PAYPAL_ENVIRONMENT to production only after sandbox QA. Charged amounts always come from the store-confirmed order total, including stored tax.</p>
      </section>
      <TaxSettingsForm
        appliesToShipping={Boolean(settings?.tax_applies_to_shipping)}
        taxMode={settings?.tax_mode}
        taxName={settings?.tax_name}
        taxRate={settings?.tax_rate_percent}
      />
      {taxMode === "not_configured" ? (
        <p className="rounded-xl border border-[#b8964c]/40 bg-white p-4 text-sm text-[#7c5d1a]">Tax configuration required. Checkout will store $0.00 tax until you choose a rate or explicitly collect no tax.</p>
      ) : (
        <p className="text-sm text-[#6b6b6b]">Tax calculation method: {taxModeLabel(taxMode)}</p>
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
