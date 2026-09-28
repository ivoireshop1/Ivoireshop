"use client";

export function QuantitySelector({ value, onChange, max }: { value: number; onChange: (value: number) => void; max?: number }) {
  const currentQuantity = Number.isFinite(value) && value > 0 ? Math.floor(value) : 1;
  const isMinimumQuantity = currentQuantity <= 1;

  function updateQuantity(nextValue: number) {
    const safeValue = Math.max(1, Math.min(max ?? Number.MAX_SAFE_INTEGER, Number.isFinite(nextValue) ? Math.floor(nextValue) : 1));
    onChange(safeValue);
  }

  return (
    <div className="inline-flex items-center overflow-hidden rounded-xl border border-black/15 bg-white shadow-sm">
      <button
        aria-label="Decrease quantity"
        aria-disabled={isMinimumQuantity}
        className="flex h-12 w-12 items-center justify-center text-xl font-semibold text-forest-green transition hover:bg-[#f5f0e6] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-forest-green/60 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-45"
        disabled={isMinimumQuantity}
        onClick={() => updateQuantity(currentQuantity - 1)}
        type="button"
      >
        −
      </button>

      <span
        aria-live="polite"
        aria-atomic="true"
        className="min-w-14 px-4 text-center text-base font-semibold text-slate-800"
      >
        {currentQuantity}
      </span>

      <button
        aria-label="Increase quantity"
        disabled={max !== undefined && currentQuantity >= max}
        className="flex h-12 w-12 items-center justify-center text-xl font-semibold text-forest-green transition hover:bg-[#f5f0e6] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-forest-green/60 focus-visible:ring-offset-2"
        onClick={() => updateQuantity(currentQuantity + 1)}
        type="button"
      >
        +
      </button>
    </div>
  );
}
