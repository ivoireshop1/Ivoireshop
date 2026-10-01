"use client";

export function PrintToolbar({ title }: { title: string }) {
  return (
    <div className="no-print mb-6 flex flex-wrap items-center justify-between gap-3 border-b border-black/10 pb-4">
      <p className="text-sm text-[#173f35]">{title}</p>
      <button
        className="min-h-11 rounded-xl bg-[#173f35] px-4 py-2 text-sm font-semibold text-white"
        type="button"
        onClick={() => window.print()}
      >
        Print
      </button>
    </div>
  );
}
