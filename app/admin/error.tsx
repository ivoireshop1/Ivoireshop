"use client";

export default function AdminError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="rounded-2xl bg-surface p-8 shadow-sm">
      <h2 className="text-2xl font-semibold text-forest-green">
        Admin data is temporarily unavailable
      </h2>
      <p className="mt-3 text-muted">
        Please try again. If the problem continues, contact a system administrator.
      </p>
      <button
        className="mt-6 rounded-lg bg-forest-green px-4 py-2 font-medium text-white"
        onClick={reset}
        type="button"
      >
        Try again
      </button>
    </div>
  );
}
