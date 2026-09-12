"use client";

export function QuantitySelector({ value, onChange }: { value: number; onChange: (value: number) => void }) {
  return <div className="inline-flex items-center rounded-lg border border-black/15"><button aria-label="Decrease quantity" className="px-4 py-2 text-lg" onClick={() => onChange(Math.max(1, value - 1))} type="button">−</button><span className="min-w-10 text-center text-sm">{value}</span><button aria-label="Increase quantity" className="px-4 py-2 text-lg" onClick={() => onChange(value + 1)} type="button">+</button></div>;
}
