"use client";

export function PrintLabelButton() {
  return (
    <button className="min-h-11 rounded-xl bg-[#173f35] px-4 text-sm font-semibold text-white print:hidden" onClick={() => window.print()} type="button">
      Print Label
    </button>
  );
}
