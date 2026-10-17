"use client";

import { useActionState } from "react";
import { saveDemoPaymentEnabled } from "@/src/lib/payments/demo-actions";
import { AdminSaveButton } from "@/src/components/admin/admin-save-button";

export function DemoPaymentSettingsForm({
  enabled,
  production,
  demoOrderCount,
  stripeLabel,
}: {
  enabled: boolean;
  production: boolean;
  demoOrderCount: number;
  stripeLabel: string;
}) {
  const [state, action, pending] = useActionState(saveDemoPaymentEnabled, null);
  const on = state?.enabled ?? enabled;
  return (
    <section className="space-y-4 rounded-2xl border border-[#b8964c]/40 bg-white p-6">
      <h2 className="text-xl font-semibold text-[#173f35]">Demo Payment</h2>
      <p className="text-sm text-[#6b6b6b]">
        Presentation checkout with no card, no Stripe request, and no real charge. Availability is stored in the database and enforced on the server.
      </p>
      {production && on ? (
        <p className="rounded-xl bg-red-50 p-3 text-sm text-red-800">
          Demo payment is enabled on production. New checkout can create TEST orders. Disable it after the presentation.
        </p>
      ) : null}
      <dl className="grid gap-3 text-sm sm:grid-cols-2">
        <div><dt className="text-[#6b6b6b]">Demo payment</dt><dd className="font-semibold text-[#173f35]">{on ? "Enabled" : "Disabled"}</dd></div>
        <div><dt className="text-[#6b6b6b]">Demo orders</dt><dd className="font-semibold text-[#173f35]">{demoOrderCount}</dd></div>
        <div><dt className="text-[#6b6b6b]">Stripe readiness</dt><dd className="font-semibold text-[#173f35]">{stripeLabel}</dd></div>
        <div><dt className="text-[#6b6b6b]">Real vs test revenue</dt><dd className="font-semibold text-[#173f35]">Demo totals are excluded from paid revenue</dd></div>
      </dl>
      <form action={action} className="flex flex-wrap gap-3">
        <input name="enabled" type="hidden" value={on ? "false" : "true"} />
        <AdminSaveButton
          failed={Boolean(state?.error) && !pending}
          idleLabel={on ? "Disable Demo Payment" : "Enable Demo Payment"}
          pending={pending}
          saved={Boolean(state?.saved) && !pending}
        />
        {state?.error ? <p className="w-full text-sm text-red-800">{state.error}</p> : null}
        {state?.saved && !pending ? <p className="w-full text-sm text-[#173f35]">Demo payment setting saved.</p> : null}
      </form>
    </section>
  );
}
