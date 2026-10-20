"use client";

import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { saveStoreDetails, type SaveStoreDetailsState } from "@/src/lib/store/profile-actions";
import { AdminSaveButton } from "@/src/components/admin/admin-save-button";
import type { StoreProfile } from "@/src/lib/store/profile-shared";

type Draft = {
  storeName: string;
  storefrontUrl: string;
  defaultCurrency: string;
  supportEmail: string;
  warehousePhone: string;
};

function toDraft(profile: StoreProfile): Draft {
  return {
    storeName: profile.storeName,
    storefrontUrl: profile.storefrontUrl,
    defaultCurrency: profile.defaultCurrency,
    supportEmail: profile.supportEmail,
    warehousePhone: profile.warehousePhone,
  };
}

export function StoreDetailsForm({ profile }: { profile: StoreProfile }) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<Draft>(() => toDraft(profile));
  const [state, action, pending] = useActionState(saveStoreDetails, null as SaveStoreDetailsState | null);

  useEffect(() => {
    if (!editing) setDraft(toDraft(profile));
  }, [profile, editing]);

  useEffect(() => {
    if (state?.draft && state.error) {
      setDraft(state.draft);
      setEditing(true);
    }
  }, [state?.draft, state?.error]);

  useEffect(() => {
    if (!state?.saved) return;
    setEditing(false);
    const timer = window.setTimeout(() => router.refresh(), 400);
    return () => window.clearTimeout(timer);
  }, [state?.saved, router]);

  const rows: Array<{ key: keyof Draft; label: string; display: string }> = [
    { key: "storeName", label: "Store name", display: profile.storeName },
    { key: "storefrontUrl", label: "Storefront URL", display: profile.storefrontUrl },
    { key: "defaultCurrency", label: "Default currency", display: profile.defaultCurrency },
    {
      key: "supportEmail",
      label: "Support email",
      display: profile.supportEmail || "Not set",
    },
    {
      key: "warehousePhone",
      label: "Warehouse phone",
      display: profile.warehousePhone || "Not set",
    },
  ];

  if (!editing) {
    return (
      <section className="rounded-[28px] border border-[#173f35]/10 bg-white p-6 shadow-[0_12px_32px_rgba(23,63,53,0.04)]">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h2 className="text-xl font-semibold text-[#173f35]">Store details</h2>
            <p className="mt-1 text-sm text-[#6b6b6b]">
              Shown on the storefront, checkout pickup copy, emails, receipts, and contact surfaces when set.
            </p>
          </div>
          <button
            className="min-h-11 rounded-xl bg-[#173f35] px-4 text-sm font-semibold text-white"
            onClick={() => {
              setDraft(toDraft(profile));
              setEditing(true);
            }}
            type="button"
          >
            Edit
          </button>
        </div>
        <div className="mt-4 space-y-3">
          {rows.map((row) => (
            <div
              className="flex flex-col gap-1 rounded-2xl border border-[#173f35]/10 bg-[#f9f7f3] p-4 md:flex-row md:items-center md:justify-between"
              key={row.key}
            >
              <span className="text-sm text-[#6b6b6b]">{row.label}</span>
              <span className="break-all text-sm font-medium text-[#173f35]">{row.display}</span>
            </div>
          ))}
        </div>
        {state?.saved && !pending ? (
          <div className="mt-4 space-y-2">
            <p className="text-sm text-[#173f35]">Store details saved.</p>
            {state.notices?.length ? (
              <ul className="list-disc space-y-1 pl-5 text-xs text-[#6b6b6b]">
                {state.notices.map((notice) => (
                  <li key={notice}>{notice}</li>
                ))}
              </ul>
            ) : null}
          </div>
        ) : null}
      </section>
    );
  }

  return (
    <section className="rounded-[28px] border border-[#173f35]/10 bg-white p-6 shadow-[0_12px_32px_rgba(23,63,53,0.04)]">
      <h2 className="text-xl font-semibold text-[#173f35]">Store details</h2>
      <p className="mt-1 text-sm text-[#6b6b6b]">Edit, then Save Changes. Nothing saves until you confirm.</p>
      <form action={action} className="mt-4 space-y-4">
        <label className="block text-sm text-[#173f35]">
          Store name
          <input
            className="mt-2 min-h-11 w-full min-w-0 rounded-xl border border-[#173f35]/15 px-3"
            name="store_name"
            onChange={(event) => setDraft((current) => ({ ...current, storeName: event.target.value }))}
            required
            value={draft.storeName}
          />
        </label>
        <label className="block text-sm text-[#173f35]">
          Storefront URL
          <input
            className="mt-2 min-h-11 w-full min-w-0 rounded-xl border border-[#173f35]/15 px-3"
            name="storefront_url"
            onChange={(event) => setDraft((current) => ({ ...current, storefrontUrl: event.target.value }))}
            required
            value={draft.storefrontUrl}
          />
          <span className="mt-1 block text-xs text-[#6b6b6b]">
            Does not change Vercel domains or Supabase Auth allowlists. You will see the external steps after save.
          </span>
        </label>
        <label className="block text-sm text-[#173f35]">
          Default currency
          <select
            className="mt-2 min-h-11 w-full min-w-0 rounded-xl border border-[#173f35]/15 px-3"
            name="default_currency"
            onChange={(event) => setDraft((current) => ({ ...current, defaultCurrency: event.target.value }))}
            value={draft.defaultCurrency}
          >
            <option value="USD">USD</option>
            <option value="EUR">EUR (blocked — not supported)</option>
            <option value="GBP">GBP (blocked — not supported)</option>
            <option value="CAD">CAD (blocked — not supported)</option>
          </select>
          <span className="mt-1 block text-xs text-[#6b6b6b]">
            Only USD is active. Other currencies are rejected so Stripe and historical orders stay intact.
          </span>
        </label>
        <label className="block text-sm text-[#173f35]">
          Support email
          <input
            className="mt-2 min-h-11 w-full min-w-0 rounded-xl border border-[#173f35]/15 px-3"
            name="support_email"
            onChange={(event) => setDraft((current) => ({ ...current, supportEmail: event.target.value }))}
            placeholder="Leave blank until verified"
            type="email"
            value={draft.supportEmail}
          />
        </label>
        <label className="block text-sm text-[#173f35]">
          Warehouse phone
          <input
            className="mt-2 min-h-11 w-full min-w-0 rounded-xl border border-[#173f35]/15 px-3"
            name="warehouse_phone"
            onChange={(event) => setDraft((current) => ({ ...current, warehousePhone: event.target.value }))}
            placeholder="Leave blank until verified"
            type="tel"
            value={draft.warehousePhone}
          />
        </label>
        {state?.error ? <p className="text-sm text-red-800">{state.error}</p> : null}
        {state?.saved && !pending ? <p className="text-sm text-[#173f35]">Store details saved.</p> : null}
        <div className="flex flex-wrap gap-3">
          <AdminSaveButton
            failed={Boolean(state?.error) && !pending}
            idleLabel="Save Changes"
            pending={pending}
            saved={Boolean(state?.saved) && !pending}
          />
          <button
            className="min-h-11 rounded-xl border border-[#173f35]/20 px-4 text-sm font-semibold text-[#173f35]"
            disabled={pending}
            onClick={() => {
              setDraft(toDraft(profile));
              setEditing(false);
            }}
            type="button"
          >
            Cancel
          </button>
        </div>
      </form>
    </section>
  );
}
