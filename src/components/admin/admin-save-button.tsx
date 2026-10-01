"use client";

import { useFormStatus } from "react-dom";

export function AdminSaveButton({
  idleLabel = "Save changes",
  saved = false,
  failed = false,
  pending = false,
}: {
  idleLabel?: string;
  saved?: boolean;
  failed?: boolean;
  pending?: boolean;
}) {
  const status = useFormStatus();
  const isPending = pending || status.pending;
  const label = isPending ? "Saving…" : failed ? "Couldn’t save" : saved ? "Saved ✓" : idleLabel;
  return (
    <button
      className="min-h-11 min-w-[9.5rem] rounded-xl bg-[#173f35] px-4 py-2 text-sm text-white disabled:opacity-70"
      disabled={isPending}
      type="submit"
    >
      {label}
    </button>
  );
}
