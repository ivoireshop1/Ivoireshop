"use client";

import { useEffect, useState } from "react";
import type { SellingSettings } from "@/src/lib/catalog/selling";
import { formatSellQuantity, lineSubtotal, roundQty, snapQuantity, unitLabel } from "@/src/lib/catalog/selling";

export function WeightSelector({
  settings,
  unitPrice,
  value,
  onChange,
  max,
}: {
  settings: SellingSettings;
  unitPrice: number;
  value: number;
  onChange: (value: number) => void;
  max?: number;
}) {
  const effectiveMax = settings.maxSellQty != null && max != null
    ? Math.min(settings.maxSellQty, max)
    : settings.maxSellQty ?? max ?? null;
  const current = snapQuantity(value, {
    ...settings,
    maxSellQty: effectiveMax,
  });
  const min = settings.minSellQty;
  const step = settings.unitIncrement;
  const atMin = current <= min + 1e-9;
  const atMax = effectiveMax != null && current >= effectiveMax - 1e-9;
  const subtotal = lineSubtotal(unitPrice, current);
  // Slider span follows admin/stock max — never a hard-coded 20 lb ceiling.
  const sliderMax = effectiveMax != null
    ? Math.max(effectiveMax, min)
    : Math.max(current, min + step * 40, 25);
  const [draft, setDraft] = useState(() => String(roundQty(current)));
  const [hint, setHint] = useState<string | null>(null);

  useEffect(() => {
    setDraft(String(roundQty(current)));
  }, [current]);

  function setQty(next: number, source: "step" | "slider" | "input" = "step") {
    const snapped = snapQuantity(next, { ...settings, maxSellQty: effectiveMax });
    onChange(snapped);
    if (source === "input") {
      if (effectiveMax != null && next > effectiveMax + 1e-9) {
        setHint(`Maximum available is ${formatSellQuantity(effectiveMax, settings.sellingUnit)}.`);
      } else if (next < min - 1e-9) {
        setHint(`Minimum purchase is ${formatSellQuantity(min, settings.sellingUnit)}.`);
      } else if (Math.abs(snapped - roundQty(next)) > 0.0005) {
        setHint(`Adjusted to the nearest ${step} ${unitLabel(settings.sellingUnit, step)} step.`);
      } else {
        setHint(null);
      }
    } else {
      setHint(null);
    }
  }

  function commitDraft() {
    const parsed = Number(String(draft).trim().replace(/,/g, ""));
    if (!Number.isFinite(parsed)) {
      setDraft(String(roundQty(current)));
      setHint(`Enter a valid weight in ${unitLabel(settings.sellingUnit, 1)}.`);
      return;
    }
    setQty(parsed, "input");
  }

  return (
    <div className="w-full max-w-md space-y-4">
      <div>
        <p className="text-sm font-medium text-forest-green">Choose how many {unitLabel(settings.sellingUnit, 2)}</p>
        <p className="mt-1 text-sm text-muted">
          ${unitPrice.toFixed(2)} / {unitLabel(settings.sellingUnit, 1)}
          {effectiveMax != null ? ` · up to ${formatSellQuantity(effectiveMax, settings.sellingUnit)}` : null}
        </p>
      </div>

      <div className="flex items-center justify-between gap-3 rounded-2xl border border-black/10 bg-white px-2 py-2 shadow-sm">
        <button
          aria-label={`Decrease by ${step} ${unitLabel(settings.sellingUnit, step)}`}
          className="flex h-12 w-12 items-center justify-center rounded-xl text-2xl font-semibold text-forest-green transition hover:bg-[#f5f0e6] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-forest-green/60 disabled:cursor-not-allowed disabled:opacity-40"
          disabled={atMin}
          onClick={() => setQty(current - step)}
          type="button"
        >
          −
        </button>
        <div className="min-w-0 flex-1 text-center" aria-live="polite" aria-atomic="true">
          <p className="text-2xl font-semibold tabular-nums text-forest-green">{formatSellQuantity(current, settings.sellingUnit)}</p>
        </div>
        <button
          aria-label={`Increase by ${step} ${unitLabel(settings.sellingUnit, step)}`}
          className="flex h-12 w-12 items-center justify-center rounded-xl text-2xl font-semibold text-forest-green transition hover:bg-[#f5f0e6] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-forest-green/60 disabled:cursor-not-allowed disabled:opacity-40"
          disabled={atMax}
          onClick={() => setQty(current + step)}
          type="button"
        >
          +
        </button>
      </div>

      <label className="block">
        <span className="mb-1.5 block text-sm font-medium text-forest-green">
          Enter weight ({unitLabel(settings.sellingUnit, 1)})
        </span>
        <input
          aria-invalid={Boolean(hint)}
          className="min-h-12 w-full rounded-xl border border-black/15 bg-white px-3 text-base tabular-nums text-forest-green shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-forest-green/60"
          inputMode="decimal"
          min={min}
          max={effectiveMax ?? undefined}
          onBlur={commitDraft}
          onChange={(event) => {
            setDraft(event.target.value);
            setHint(null);
          }}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              commitDraft();
            }
          }}
          step={step}
          type="number"
          value={draft}
        />
      </label>

      <label className="block">
        <span className="sr-only">Adjust weight with slider</span>
        <input
          aria-valuemax={sliderMax}
          aria-valuemin={min}
          aria-valuenow={current}
          className="h-2 w-full cursor-pointer appearance-none rounded-full bg-[#e8e2d6] accent-forest-green"
          max={sliderMax}
          min={min}
          onChange={(event) => setQty(Number(event.target.value), "slider")}
          step={step}
          type="range"
          value={Math.min(current, sliderMax)}
        />
      </label>

      {hint ? <p className="text-sm text-[#7c5d1a]" role="status">{hint}</p> : null}

      <p className="text-base font-semibold text-forest-green">
        Subtotal: <span className="tabular-nums">${subtotal.toFixed(2)}</span>
      </p>
    </div>
  );
}
