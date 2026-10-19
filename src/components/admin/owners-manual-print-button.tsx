"use client";

export function OwnersManualPrintButton() {
  return (
    <button
      className="min-h-11 rounded-xl bg-[#173f35] px-4 py-2 text-sm font-semibold text-white print:hidden"
      onClick={() => window.print()}
      type="button"
    >
      Print / save PDF
    </button>
  );
}
