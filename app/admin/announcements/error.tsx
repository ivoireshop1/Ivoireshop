"use client";

import { AdminSupportFallback } from "@/src/components/admin/admin-support-fallback";

export default function AnnouncementsError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="min-w-0 rounded-2xl bg-white p-8 shadow-sm">
      <h1 className="text-2xl font-semibold text-[#173f35]">Announcements</h1>
      <p className="mt-3 text-sm text-[#6b6b6b]">Unable to load announcements.</p>
      <p className="mt-2 text-xs text-[#6b6b6b]">Reference: ADM-ANNOUNCEMENTS-LOAD</p>
      <button className="mt-6 rounded-lg bg-[#173f35] px-4 py-2 font-medium text-white" onClick={reset} type="button">
        Try again
      </button>
      <AdminSupportFallback />
    </div>
  );
}
