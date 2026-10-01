"use client";

import { useFormStatus } from "react-dom";

export function AdminSaveButton({
  idleLabel = "Save changes",
  saved = false,
  failed = false,
}: {
  idleLabel?: string;
  saved?: boolean;
  failed?: boolean;
}) {
  const { pending } = useFormStatus();
  const label = pending ? "Saving…" : failed ? "Couldn’t save changes" : saved ? "Saved ✓" : idleLabel;
  return (
    <button
      className="min-h-11 min-w-[9.5rem] rounded-xl bg-[#173f35] px-4 py-2 text-sm text-white disabled:opacity-70"
      disabled={pending}
      type="submit"
    >
      {label}
    </button>
  );
}
