"use client";

import { productCategories } from "@/src/types/catalog";

export function CategoryFilter({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  return <div className="flex gap-2 overflow-x-auto pb-2"><button className={`whitespace-nowrap rounded-full px-4 py-2 text-sm ${value === "All Products" ? "bg-forest-green text-white" : "border border-black/10 bg-surface text-muted"}`} onClick={() => onChange("All Products")} type="button">All Products</button>{productCategories.map((category) => <button className={`whitespace-nowrap rounded-full px-4 py-2 text-sm ${value === category ? "bg-forest-green text-white" : "border border-black/10 bg-surface text-muted"}`} key={category} onClick={() => onChange(category)} type="button">{category}</button>)}</div>;
}
