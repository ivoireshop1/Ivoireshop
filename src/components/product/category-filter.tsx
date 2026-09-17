"use client";

export function CategoryFilter({ categories, value, onChange }: { categories: string[]; value: string; onChange: (value: string) => void }) {
  const normalizedValue = value === "All Products" ? "All" : value;
  return <div className="flex gap-2 overflow-x-auto pb-2"><button className={`whitespace-nowrap rounded-full px-4 py-2 text-sm ${normalizedValue === "All" ? "bg-forest-green text-white" : "border border-black/10 bg-surface text-muted"}`} onClick={() => onChange("All")} type="button">All</button>{categories.map((category) => <button className={`whitespace-nowrap rounded-full px-4 py-2 text-sm ${normalizedValue === category ? "bg-forest-green text-white" : "border border-black/10 bg-surface text-muted"}`} key={category} onClick={() => onChange(category)} type="button">{category}</button>)}</div>;
}
