"use client";

import { useActionState } from "react";
import { AdminSaveButton } from "@/src/components/admin/admin-save-button";
import { saveRateTableSettings } from "@/src/lib/delivery/actions";
import { RATE_TABLE_BRACKETS_LB, RATE_TABLE_SERVICES, parseRateTableConfig, rateTableIsComplete, type RateTableService } from "@/src/lib/shipping/rate-table";

const LABELS: Record<RateTableService, string> = {
  ground: "Ground",
  priority: "Priority",
  express: "Express",
};

export function RateTableForm({ settings }: { settings: Record<string, unknown> | null }) {
  const config = parseRateTableConfig(settings);
  const [state, action, pending] = useActionState(saveRateTableSettings, null);
  return (
    <form action={action} className="space-y-4 rounded-2xl bg-white p-5">
      <h2 className="font-semibold text-[#173f35]">Domestic rate table (fallback)</h2>
      <p className="text-sm text-[#6b6b6b]">
        STORE-CALCULATED domestic US prices only. Stays off until you price every bracket and enable it.
        Checkout never substitutes these amounts when a live UPS/USPS rate is already shown. 40+ lb stays pickup or contact the store.
      </p>
      <label className="flex items-start gap-2 text-sm text-[#173f35]">
        <input defaultChecked={config.enabled} name="rate_table_enabled" type="checkbox" />
        <span>Enable founder-approved table as an explicit fallback</span>
      </label>
      <label className="block text-sm text-[#173f35]">
        Buffer % (starts at 10)
        <input
          className="mt-2 w-full max-w-xs rounded-xl border border-[#173f35]/15 px-3 py-2"
          defaultValue={Math.round(config.buffer * 100)}
          min="0"
          max="100"
          name="rate_table_buffer"
          step="1"
          type="number"
        />
      </label>
      <div className="overflow-x-auto">
        <table className="min-w-full text-left text-sm">
          <thead>
            <tr className="text-[#6b6b6b]">
              <th className="py-2 pr-3">Bracket</th>
              {RATE_TABLE_SERVICES.map((service) => (
                <th className="py-2 pr-3" key={service}>{LABELS[service]} USD</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {RATE_TABLE_BRACKETS_LB.map((max, index) => (
              <tr key={max}>
                <td className="py-2 pr-3">{index === 0 ? `0–${max}` : `${RATE_TABLE_BRACKETS_LB[index - 1]}–${max}`} lb</td>
                {RATE_TABLE_SERVICES.map((service) => (
                  <td className="py-2 pr-3" key={`${service}-${max}`}>
                    <input
                      className="w-24 rounded-xl border border-[#173f35]/15 px-2 py-1"
                      defaultValue={config.amounts[service][String(max)] ?? ""}
                      min="0.01"
                      name={`${service}_${max}`}
                      step="0.01"
                      type="number"
                    />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-[#6b6b6b]">
        {rateTableIsComplete(config) ? "All brackets have amounts." : "Table cannot be offered until every Ground, Priority, and Express amount is entered."}
        Verify these against actual fulfillment cost before enabling.
      </p>
      <AdminSaveButton failed={Boolean(state?.error) && !pending} pending={pending} saved={Boolean(state?.saved) && !pending} />
      {state?.error ? <p className="text-sm text-red-800">{state.error}</p> : null}
    </form>
  );
}
