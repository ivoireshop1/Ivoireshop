"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/src/lib/supabase/browser";

export function AddAddressForm() {
  const router = useRouter();
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState("");
  const [open, setOpen] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setIsSaving(true);
    const form = new FormData(event.currentTarget);
    const value = (name: string) => String(form.get(name) ?? "").trim();
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      setIsSaving(false);
      setError("Sign in to save a delivery address.");
      return;
    }
    const { error: insertError } = await supabase.from("addresses").insert({
      user_id: user.id,
      full_name: value("full_name"),
      phone: value("phone"),
      address_line_1: value("address_line_1"),
      address_line_2: value("address_line_2") || null,
      city: value("city"),
      state: value("state") || null,
      postal_code: value("postal_code") || null,
      country: value("country"),
      is_default: form.get("is_default") === "on",
    });
    setIsSaving(false);
    if (insertError) {
      setError("We couldn’t save that address. Please try again.");
      return;
    }
    event.currentTarget.reset();
    setOpen(false);
    router.refresh();
  }

  if (!open) {
    return (
      <button className="mt-4 text-sm font-semibold text-forest-green underline underline-offset-4" onClick={() => setOpen(true)} type="button">
        Add a delivery address
      </button>
    );
  }

  return (
    <form className="mt-4 space-y-3" onSubmit={handleSubmit}>
      <input className="w-full rounded-lg border border-black/15 bg-white px-3 py-2 text-sm" name="full_name" placeholder="Label or name" required />
      <input className="w-full rounded-lg border border-black/15 bg-white px-3 py-2 text-sm" name="phone" placeholder="Phone" required />
      <input className="w-full rounded-lg border border-black/15 bg-white px-3 py-2 text-sm" name="address_line_1" placeholder="Street address" required />
      <input className="w-full rounded-lg border border-black/15 bg-white px-3 py-2 text-sm" name="address_line_2" placeholder="Apartment, suite (optional)" />
      <div className="grid gap-3 sm:grid-cols-2">
        <input className="rounded-lg border border-black/15 bg-white px-3 py-2 text-sm" name="city" placeholder="City" required />
        <input className="rounded-lg border border-black/15 bg-white px-3 py-2 text-sm" name="state" placeholder="State" />
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <input className="rounded-lg border border-black/15 bg-white px-3 py-2 text-sm" name="postal_code" placeholder="ZIP / postal code" />
        <input className="rounded-lg border border-black/15 bg-white px-3 py-2 text-sm" name="country" placeholder="Country" required />
      </div>
      <label className="flex items-center gap-2 text-sm text-muted">
        <input name="is_default" type="checkbox" />
        Default address
      </label>
      {error ? <p className="text-sm text-red-800">{error}</p> : null}
      <div className="flex flex-wrap gap-3">
        <button className="rounded-lg bg-forest-green px-4 py-2 text-sm font-semibold text-white disabled:opacity-60" disabled={isSaving} type="submit">
          {isSaving ? "Saving..." : "Save address"}
        </button>
        <button className="text-sm font-semibold text-muted" onClick={() => setOpen(false)} type="button">
          Cancel
        </button>
      </div>
    </form>
  );
}
