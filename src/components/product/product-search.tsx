"use client";

export function ProductSearch({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  return <label className="block"><span className="sr-only">Search products</span><input className="w-full rounded-lg border border-black/15 bg-surface px-4 py-3 text-sm outline-none transition focus:border-gold" onChange={(event) => onChange(event.target.value)} placeholder="Search products..." type="search" value={value} /></label>;
}
